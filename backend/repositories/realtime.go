package repositories

import (
	"context"
	"github.com/noval110/footguard/backend/models"
	"time"
)

func (s *Store) CreateRealtimeTicket(ctx context.Context, hash string, userID int64, sessionExpiry time.Time) (int64, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM realtime_tickets WHERE expires_at<now()`); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM realtime_events WHERE id IN (SELECT id FROM realtime_events WHERE expires_at<now() LIMIT 1000)`); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO realtime_tickets(token_hash,user_id,expires_at,session_expires_at) VALUES($1,$2,now()+interval '30 seconds',$3)`, hash, userID, sessionExpiry); err != nil {
		return 0, err
	}
	var cursor int64
	if err = tx.QueryRow(ctx, `SELECT COALESCE(max(id),0) FROM realtime_events`).Scan(&cursor); err != nil {
		return 0, err
	}
	return cursor, tx.Commit(ctx)
}

func (s *Store) ConsumeRealtimeTicket(ctx context.Context, hash string) (models.User, time.Time, error) {
	var id int64
	var expiry time.Time
	err := s.DB.QueryRow(ctx, `DELETE FROM realtime_tickets WHERE token_hash=$1 AND expires_at>now() AND session_expires_at>now() RETURNING user_id,session_expires_at`, hash).Scan(&id, &expiry)
	if err != nil {
		return models.User{}, expiry, one(err)
	}
	user, err := s.UserByID(ctx, id)
	if err == nil && (!user.IsActive || user.Role != "patient" && user.Role != "provider") {
		err = ErrNotFound
	}
	return user, expiry, err
}

func (s *Store) RealtimeEvents(ctx context.Context, userID, after int64) ([]models.RealtimeEvent, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,kind,payload FROM realtime_events WHERE user_id=$1 AND id>$2 AND expires_at>now() ORDER BY id LIMIT 100`, userID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.RealtimeEvent, 0)
	for rows.Next() {
		var e models.RealtimeEvent
		if err = rows.Scan(&e.ID, &e.Kind, &e.Payload); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func (s *Store) Notifications(ctx context.Context, userID int64) ([]models.Notification, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,kind,conversation_id,examination_id,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Notification, 0)
	for rows.Next() {
		var n models.Notification
		if err = rows.Scan(&n.ID, &n.Kind, &n.ConversationID, &n.ExaminationID, &n.CreatedAt, &n.ReadAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) ReadNotification(ctx context.Context, userID, id int64) error {
	tag, err := s.DB.Exec(ctx, `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND id=$2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
