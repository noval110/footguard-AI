package repositories

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/services"
	"time"
)

func scanCall(row pgx.Row) (models.CallSession, error) {
	var c models.CallSession
	err := row.Scan(&c.ID, &c.ConversationID, &c.AppointmentID, &c.CallerID, &c.Status, &c.CreatedAt, &c.StartedAt, &c.EndedAt)
	return c, one(err)
}

const callColumns = `id,conversation_id,appointment_id,caller_id,status,created_at,started_at,ended_at`

func (s *Store) Call(ctx context.Context, user models.User, id int64) (models.CallSession, error) {
	call, err := scanCall(s.DB.QueryRow(ctx, `SELECT `+callColumns+` FROM call_sessions WHERE id=$1`, id))
	if err != nil {
		return call, err
	}
	if _, err = s.Conversation(ctx, user, call.ConversationID); err != nil {
		return models.CallSession{}, err
	}
	return call, nil
}

func (s *Store) Calls(ctx context.Context, user models.User, conversationID int64) ([]models.CallSession, error) {
	if _, err := s.Conversation(ctx, user, conversationID); err != nil {
		return nil, err
	}
	rows, err := s.DB.Query(ctx, `SELECT `+callColumns+` FROM call_sessions WHERE conversation_id=$1 ORDER BY id DESC LIMIT 30`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.CallSession, 0)
	for rows.Next() {
		c, err := scanCall(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateCall(ctx context.Context, user models.User, conversationID int64, appointmentID *int64) (models.CallSession, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.CallSession{}, err
	}
	defer tx.Rollback(ctx)
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return models.CallSession{}, err
	}
	// Expire abandoned invitations/connections before allocating a new call.
	if _, err = tx.Exec(ctx, `UPDATE call_sessions SET status='failed',ended_at=now(),updated_at=now() WHERE conversation_id=$1
        AND (status='calling' AND created_at<now()-interval '60 seconds' OR status IN ('connecting','connected') AND updated_at<now()-interval '90 seconds')`, conversationID); err != nil {
		return models.CallSession{}, err
	}
	if appointmentID != nil {
		var valid bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM appointments WHERE id=$1 AND conversation_id=$2 AND status='confirmed'
            AND scheduled_at BETWEEN now()-interval '1 hour' AND now()+interval '15 minutes')`, appointmentID, conversationID).Scan(&valid)
		if err != nil {
			return models.CallSession{}, err
		}
		if !valid {
			return models.CallSession{}, ErrTransition
		}
	}
	call, err := scanCall(tx.QueryRow(ctx, `INSERT INTO call_sessions(conversation_id,appointment_id,caller_id) VALUES($1,$2,$3) RETURNING `+callColumns, conversationID, appointmentID, user.ID))
	if err != nil {
		return call, err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "call_state", call, false); err != nil {
		return call, err
	}
	return call, tx.Commit(ctx)
}

func (s *Store) UpdateCall(ctx context.Context, user models.User, id int64, status string) (models.CallSession, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.CallSession{}, err
	}
	defer tx.Rollback(ctx)
	var conversationID int64
	if err = tx.QueryRow(ctx, `SELECT conversation_id FROM call_sessions WHERE id=$1`, id).Scan(&conversationID); err != nil {
		return models.CallSession{}, one(err)
	}
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return models.CallSession{}, err
	}
	call, err := scanCall(tx.QueryRow(ctx, `SELECT `+callColumns+` FROM call_sessions WHERE id=$1 FOR UPDATE`, id))
	if err != nil {
		return call, err
	}
	if !services.CallTransition(call.Status, status, call.CallerID == user.ID) {
		return call, ErrTransition
	}
	if call.Status == "calling" && time.Since(call.CreatedAt) > 60*time.Second && (status == "connecting" || status == "rejected") {
		return call, ErrTransition
	}
	call, err = scanCall(tx.QueryRow(ctx, `UPDATE call_sessions SET status=$2::text,updated_at=now(),
        started_at=CASE WHEN $2='connected' THEN COALESCE(started_at,now()) ELSE started_at END,
        ended_at=CASE WHEN $2 IN ('ended','failed','rejected') THEN now() ELSE ended_at END WHERE id=$1 RETURNING `+callColumns, id, status))
	if err != nil {
		return call, err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "call_state", call, false); err != nil {
		return call, err
	}
	return call, tx.Commit(ctx)
}

func (s *Store) Signal(ctx context.Context, user models.User, id int64, kind string, payload json.RawMessage) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var conversationID int64
	if err = tx.QueryRow(ctx, `SELECT conversation_id FROM call_sessions WHERE id=$1`, id).Scan(&conversationID); err != nil {
		return one(err)
	}
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return err
	}
	call, err := scanCall(tx.QueryRow(ctx, `SELECT `+callColumns+` FROM call_sessions WHERE id=$1 FOR UPDATE`, id))
	if err != nil {
		return err
	}
	if call.Status != "calling" && call.Status != "connecting" && call.Status != "connected" {
		return ErrTransition
	}
	if call.Status == "calling" && time.Since(call.CreatedAt) > 60*time.Second {
		return ErrTransition
	}
	if kind == "call_offer" && (user.ID != call.CallerID || call.Status != "calling") {
		return ErrTransition
	}
	if kind == "call_answer" && (user.ID == call.CallerID || call.Status != "connecting") {
		return ErrTransition
	}
	if kind != "call_offer" && kind != "call_answer" && kind != "ice_candidate" {
		return ErrTransition
	}
	peer := c.ProviderID
	if user.ID == peer {
		peer = c.PatientUserID
	}
	if err = emit(ctx, tx, []int64{peer}, kind, map[string]any{"call": call, "data": payload}, true); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) HeartbeatCall(ctx context.Context, user models.User, id int64) error {
	call, err := s.Call(ctx, user, id)
	if err != nil {
		return err
	}
	tag, err := s.DB.Exec(ctx, `UPDATE call_sessions SET updated_at=now() WHERE id=$1 AND status IN ('connecting','connected')`, call.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrTransition
	}
	return nil
}

// Expire disconnected sessions even when nobody starts another call.
func (s *Store) ExpireCalls(ctx context.Context) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `UPDATE call_sessions SET status='failed',ended_at=now(),updated_at=now()
	 WHERE status='calling' AND created_at<now()-interval '60 seconds'
	 OR status IN ('connecting','connected') AND updated_at<now()-interval '90 seconds' RETURNING `+callColumns)
	if err != nil {
		return err
	}
	calls := make([]models.CallSession, 0)
	for rows.Next() {
		call, err := scanCall(rows)
		if err != nil {
			rows.Close()
			return err
		}
		calls = append(calls, call)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, call := range calls {
		var patientID, providerID int64
		if err = tx.QueryRow(ctx, `SELECT p.user_id,c.provider_id FROM conversations c JOIN patients p ON p.id=c.patient_id WHERE c.id=$1`, call.ConversationID).Scan(&patientID, &providerID); err != nil {
			return err
		}
		if err = emit(ctx, tx, []int64{patientID, providerID}, "call_state", call, false); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
