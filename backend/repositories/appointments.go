package repositories

import (
	"context"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/services"
	"time"
)

func (s *Store) Appointments(ctx context.Context, user models.User) ([]models.Appointment, error) {
	rows, err := s.DB.Query(ctx, `SELECT a.id,a.conversation_id,a.scheduled_at,a.status,a.notes,a.created_at,a.updated_at,pu.name,pr.name,c.examination_id
        FROM appointments a JOIN conversations c ON c.id=a.conversation_id JOIN patients p ON p.id=c.patient_id
        JOIN users pu ON pu.id=p.user_id JOIN users pr ON pr.id=c.provider_id WHERE `+participantSQL+`
        ORDER BY CASE WHEN a.status IN ('requested','confirmed') THEN 0 ELSE 1 END,a.scheduled_at,a.id LIMIT 100`, user.ID, user.Role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Appointment, 0)
	for rows.Next() {
		var a models.Appointment
		if err = rows.Scan(&a.ID, &a.ConversationID, &a.ScheduledAt, &a.Status, &a.Notes, &a.CreatedAt, &a.UpdatedAt, &a.PatientName, &a.ProviderName, &a.ExaminationID); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) CreateAppointment(ctx context.Context, user models.User, conversationID int64, scheduled time.Time, notes string) (models.Appointment, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Appointment{}, err
	}
	defer tx.Rollback(ctx)
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return models.Appointment{}, err
	}
	if user.Role != "patient" {
		return models.Appointment{}, ErrNotFound
	}
	var a models.Appointment
	err = tx.QueryRow(ctx, `INSERT INTO appointments(conversation_id,scheduled_at,notes) VALUES($1,$2,$3) RETURNING id,conversation_id,scheduled_at,status,notes,created_at,updated_at`, conversationID, scheduled.UTC(), notes).
		Scan(&a.ID, &a.ConversationID, &a.ScheduledAt, &a.Status, &a.Notes, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return a, err
	}
	if err = notify(ctx, tx, c.ProviderID, "appointment_requested", &c.ID, c.ExaminationID); err != nil {
		return a, err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "appointment", map[string]any{"conversation_id": c.ID, "appointment_id": a.ID, "status": a.Status}, false); err != nil {
		return a, err
	}
	return a, tx.Commit(ctx)
}

func (s *Store) UpdateAppointment(ctx context.Context, user models.User, id int64, status string) (models.Appointment, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Appointment{}, err
	}
	defer tx.Rollback(ctx)
	var conversationID int64
	if err = tx.QueryRow(ctx, `SELECT conversation_id FROM appointments WHERE id=$1`, id).Scan(&conversationID); err != nil {
		return models.Appointment{}, one(err)
	}
	c, err := lockConversation(ctx, tx, user, conversationID)
	if err != nil {
		return models.Appointment{}, err
	}
	var a models.Appointment
	err = tx.QueryRow(ctx, `SELECT id,conversation_id,scheduled_at,status,notes,created_at,updated_at FROM appointments WHERE id=$1 FOR UPDATE`, id).
		Scan(&a.ID, &a.ConversationID, &a.ScheduledAt, &a.Status, &a.Notes, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return a, one(err)
	}
	if !services.AppointmentTransition(user.Role, a.Status, status) || status == "confirmed" && !a.ScheduledAt.After(time.Now()) || status == "completed" && a.ScheduledAt.After(time.Now()) {
		return a, ErrTransition
	}
	// A consultation occupies a 30-minute slot. Serialize confirmations per provider to avoid races.
	if status == "confirmed" {
		if _, err = tx.Exec(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, c.ProviderID); err != nil {
			return a, err
		}
		var conflict bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM appointments a JOIN conversations c ON c.id=a.conversation_id
            WHERE c.provider_id=$1 AND a.id<>$2 AND a.status='confirmed' AND a.scheduled_at < $3::timestamptz+interval '30 minutes'
            AND a.scheduled_at+interval '30 minutes' > $3::timestamptz)`, c.ProviderID, id, a.ScheduledAt).Scan(&conflict)
		if err != nil {
			return a, err
		}
		if conflict {
			return a, ErrTransition
		}
	}
	if err = tx.QueryRow(ctx, `UPDATE appointments SET status=$2,updated_at=now() WHERE id=$1 RETURNING status,updated_at`, id, status).Scan(&a.Status, &a.UpdatedAt); err != nil {
		return a, err
	}
	peer := c.ProviderID
	if user.ID == peer {
		peer = c.PatientUserID
	}
	if err = notify(ctx, tx, peer, "appointment_"+status, &c.ID, c.ExaminationID); err != nil {
		return a, err
	}
	if err = emit(ctx, tx, []int64{c.PatientUserID, c.ProviderID}, "appointment", map[string]any{"conversation_id": c.ID, "appointment_id": id, "status": status}, false); err != nil {
		return a, err
	}
	return a, tx.Commit(ctx)
}
