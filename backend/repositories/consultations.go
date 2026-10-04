package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/services"
)

var ErrTransition = errors.New("invalid state transition")

const participantSQL = `(p.user_id=$1 AND $2='patient' OR c.provider_id=$1 AND $2='provider')`
const conversationSelect = `SELECT c.id,c.patient_id,p.user_id,c.provider_id,c.examination_id,pu.name,pr.name,
    (SELECT CASE WHEN deleted_at IS NOT NULL THEN 'Pesan dihapus' ELSE message END FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1),
    (SELECT count(*) FROM messages WHERE conversation_id=c.id AND sender_id<>$1 AND read_at IS NULL AND deleted_at IS NULL),c.created_at,c.updated_at
    FROM conversations c JOIN patients p ON p.id=c.patient_id JOIN users pu ON pu.id=p.user_id JOIN users pr ON pr.id=c.provider_id`

func scanConversation(row pgx.Row) (models.Conversation, error) {
	var c models.Conversation
	err := row.Scan(&c.ID, &c.PatientID, &c.PatientUserID, &c.ProviderID, &c.ExaminationID, &c.PatientName, &c.ProviderName, &c.LastMessage, &c.UnreadCount, &c.CreatedAt, &c.UpdatedAt)
	return c, one(err)
}

func (s *Store) Conversation(ctx context.Context, user models.User, id int64) (models.Conversation, error) {
	return scanConversation(s.DB.QueryRow(ctx, conversationSelect+` WHERE c.id=$3 AND `+participantSQL, user.ID, user.Role, id))
}

func (s *Store) Conversations(ctx context.Context, user models.User) ([]models.Conversation, error) {
	rows, err := s.DB.Query(ctx, conversationSelect+` WHERE `+participantSQL+` ORDER BY c.updated_at DESC,c.id DESC LIMIT 100`, user.ID, user.Role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]models.Conversation, 0)
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// Patients choose an active provider; providers may initiate with patients in the existing review directory.
// Identity and context are validated here, never inferred from client role/sender fields.
func (s *Store) CreateConversation(ctx context.Context, user models.User, patientID, providerID int64, examID *int64) (models.Conversation, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Conversation{}, err
	}
	defer tx.Rollback(ctx)
	if user.Role == "patient" {
		if err = tx.QueryRow(ctx, `SELECT id FROM patients WHERE user_id=$1`, user.ID).Scan(&patientID); err != nil {
			return models.Conversation{}, one(err)
		}
	} else if user.Role == "provider" {
		providerID = user.ID
	} else {
		return models.Conversation{}, ErrNotFound
	}
	var valid bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM patients p JOIN users pu ON pu.id=p.user_id JOIN users pr ON pr.id=$2
        WHERE p.id=$1 AND pu.is_active AND pu.role='patient' AND pr.is_active AND pr.role='provider'
        AND ($3::bigint IS NULL OR EXISTS(SELECT 1 FROM examinations WHERE id=$3 AND patient_id=p.id)))`, patientID, providerID, examID).Scan(&valid)
	if err != nil {
		return models.Conversation{}, err
	}
	if !valid {
		return models.Conversation{}, ErrNotFound
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO conversations(patient_id,provider_id,examination_id) VALUES($1,$2,$3)
        ON CONFLICT (patient_id,provider_id,(COALESCE(examination_id,0))) DO UPDATE SET patient_id=EXCLUDED.patient_id RETURNING id`, patientID, providerID, examID).Scan(&id)
	if err != nil {
		return models.Conversation{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return models.Conversation{}, err
	}
	return s.Conversation(ctx, user, id)
}

func (s *Store) ConsultationProviders(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,name FROM users WHERE role='provider' AND is_active ORDER BY name,id LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var name string
		if err = rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name})
	}
	return out, rows.Err()
}

func lockConversation(ctx context.Context, tx pgx.Tx, user models.User, id int64) (models.Conversation, error) {
	var c models.Conversation
	err := tx.QueryRow(ctx, `SELECT c.id,c.patient_id,p.user_id,c.provider_id,c.examination_id FROM conversations c JOIN patients p ON p.id=c.patient_id
        JOIN users pu ON pu.id=p.user_id JOIN users pr ON pr.id=c.provider_id
        WHERE c.id=$3 AND `+participantSQL+` AND pu.is_active AND pr.is_active AND pu.role='patient' AND pr.role='provider' FOR UPDATE OF c`, user.ID, user.Role, id).
		Scan(&c.ID, &c.PatientID, &c.PatientUserID, &c.ProviderID, &c.ExaminationID)
	return c, one(err)
}

// Serialize event allocation until commit so a cursor cannot skip a concurrent uncommitted event.
func emit(ctx context.Context, tx pgx.Tx, recipients []int64, kind string, payload any, signal bool) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(724105)`); err != nil {
		return err
	}
	lifetime := "1 day"
	if signal {
		lifetime = "2 minutes"
	}
	for _, userID := range recipients {
		if _, err = tx.Exec(ctx, `INSERT INTO realtime_events(user_id,kind,payload,expires_at) VALUES($1,$2,$3,now()+$4::interval)`, userID, kind, data, lifetime); err != nil {
			return err
		}
	}
	return nil
}

func notify(ctx context.Context, tx pgx.Tx, userID int64, kind string, conversationID, examID *int64) error {
	_, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,kind,conversation_id,examination_id) VALUES($1,$2,$3,$4)`, userID, kind, conversationID, examID)
	return err
}

func (s *Store) Messages(ctx context.Context, user models.User, id, before, since int64) ([]models.Message, error) {
	if _, err := s.Conversation(ctx, user, id); err != nil {
		return nil, err
	}
	rows, err := s.DB.Query(ctx, `SELECT m.id,m.conversation_id,m.sender_id,u.name,m.message,m.created_at,m.read_at,m.edited_at,m.deleted_at FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE conversation_id=$1 AND ($2::bigint=0 OR m.id<$2) AND ($3::bigint=0 OR m.id>=$3)
        ORDER BY m.id DESC LIMIT CASE WHEN $3::bigint=0 THEN 50 ELSE 500 END`, id, before, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Message, 0)
	for rows.Next() {
		var m models.Message
		if err = rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderName, &m.Message, &m.CreatedAt, &m.ReadAt, &m.EditedAt, &m.DeletedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) SendMessage(ctx context.Context, user models.User, id int64, message string) (models.Message, error) {
	message = strings.TrimSpace(message)
	if !services.ValidMessage(message) {
		return models.Message{}, ErrTransition
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Message{}, err
	}
	defer tx.Rollback(ctx)
	c, err := lockConversation(ctx, tx, user, id)
	if err != nil {
		return models.Message{}, err
	}
	var m models.Message
	m.SenderName = user.Name
	err = tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,sender_id,message) VALUES($1,$2,$3) RETURNING id,conversation_id,sender_id,message,created_at,read_at`, id, user.ID, message).
		Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Message, &m.CreatedAt, &m.ReadAt)
	if err != nil {
		return m, err
	}
	if _, err = tx.Exec(ctx, `UPDATE conversations SET updated_at=now() WHERE id=$1`, id); err != nil {
		return m, err
	}
	peer := c.ProviderID
	if user.ID == peer {
		peer = c.PatientUserID
	}
	if err = notify(ctx, tx, peer, "message", &id, c.ExaminationID); err != nil {
		return m, err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "message", map[string]any{"conversation_id": id, "message_id": m.ID}, false); err != nil {
		return m, err
	}
	return m, tx.Commit(ctx)
}

// Both actions require membership and ownership, and commit with their delivery events.
func (s *Store) ChangeMessage(ctx context.Context, user models.User, conversationID, messageID int64, message string, remove bool) (models.Message, error) {
	message = strings.TrimSpace(message)
	if !remove && !services.ValidMessage(message) {
		return models.Message{}, ErrTransition
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Message{}, err
	}
	defer tx.Rollback(ctx)
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return models.Message{}, err
	}
	query := `UPDATE messages SET message=$4,edited_at=clock_timestamp()
        WHERE conversation_id=$1 AND id=$2 AND sender_id=$3 AND deleted_at IS NULL`
	kind := "message_updated"
	if remove {
		message = ""
		query = `UPDATE messages SET message=$4,deleted_at=clock_timestamp()
            WHERE conversation_id=$1 AND id=$2 AND sender_id=$3 AND deleted_at IS NULL`
		kind = "message_deleted"
	}
	var m models.Message
	m.SenderName = user.Name
	err = tx.QueryRow(ctx, query+` RETURNING id,conversation_id,sender_id,message,created_at,read_at,edited_at,deleted_at`, conversationID, messageID, user.ID, message).
		Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Message, &m.CreatedAt, &m.ReadAt, &m.EditedAt, &m.DeletedAt)
	if err != nil {
		return m, one(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE conversations SET updated_at=now() WHERE id=$1`, conversationID); err != nil {
		return m, err
	}
	if remove {
		// Clear stale message notices once there are no remaining unread messages.
		if _, err = tx.Exec(ctx, `UPDATE notifications SET read_at=now() WHERE conversation_id=$1 AND kind='message' AND read_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=$1 AND sender_id<>notifications.user_id AND read_at IS NULL AND deleted_at IS NULL)`, conversationID); err != nil {
			return m, err
		}
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, kind, map[string]any{"conversation_id": conversationID, "message_id": messageID}, false); err != nil {
		return m, err
	}
	return m, tx.Commit(ctx)
}

func (s *Store) ReadMessages(ctx context.Context, user models.User, id, through int64) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	c, err := lockConversation(ctx, tx, user, id)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_id<>$2 AND id<=$3 AND read_at IS NULL AND deleted_at IS NULL`, id, user.ID, through); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND conversation_id=$2 AND kind='message' AND read_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=$2 AND sender_id<>$1 AND read_at IS NULL AND deleted_at IS NULL)`, user.ID, id); err != nil {
		return err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "messages_read", map[string]any{"conversation_id": id}, false); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
