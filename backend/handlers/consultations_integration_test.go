package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/noval110/footguard/backend/database"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/routes"
	"github.com/noval110/footguard/backend/services"
	"golang.org/x/net/websocket"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestConsultationWorkflowWithPostgres(t *testing.T) {
	url := os.Getenv("FOOTGUARD_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set FOOTGUARD_TEST_DATABASE_URL to an isolated PostgreSQL database with migrations 001–006")
	}
	ctx := context.Background()
	pool, err := database.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store := repositories.New(pool)
	auth := services.NewAuth("consultation-test-secret-at-least-32-characters")
	suffix := fmt.Sprint(time.Now().UnixNano())
	patient, err := store.CreatePatientUser(ctx, "Consultation Patient", "cp"+suffix+"@example.com", "unused")
	if err != nil {
		t.Fatal(err)
	}
	other, err := store.CreatePatientUser(ctx, "Other Patient", "co"+suffix+"@example.com", "unused")
	if err != nil {
		t.Fatal(err)
	}
	provider, err := store.CreateProviderUser(ctx, "Consultation Provider", "dr"+suffix+"@example.com", "unused")
	if err != nil {
		t.Fatal(err)
	}
	unrelated, err := store.CreateProviderUser(ctx, "Unrelated Provider", "du"+suffix+"@example.com", "unused")
	if err != nil {
		t.Fatal(err)
	}
	users := []int64{patient.ID, other.ID, provider.ID, unrelated.ID}
	defer func() {
		// Delete only this test's fixtures, in dependency order. Never truncate shared tables.
		for _, sql := range []string{
			`DELETE FROM realtime_events WHERE user_id=ANY($1)`, `DELETE FROM realtime_tickets WHERE user_id=ANY($1)`, `DELETE FROM notifications WHERE user_id=ANY($1)`,
			`DELETE FROM call_sessions WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id=ANY($1))`,
			`DELETE FROM appointments WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id=ANY($1))`,
			`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id=ANY($1))`,
			`DELETE FROM conversations WHERE provider_id=ANY($1)`, `DELETE FROM medical_reviews WHERE reviewer_id=ANY($1)`, `DELETE FROM users WHERE id=ANY($1)`,
		} {
			if _, err := pool.Exec(ctx, sql, users); err != nil {
				t.Errorf("fixture cleanup: %v", err)
			}
		}
	}()
	origin := "http://localhost:5173"
	server := httptest.NewServer(routes.New(store, auth, origin, "http://127.0.0.1:8000"))
	defer server.Close()
	token := func(user models.User) string {
		raw, err := auth.Token(user.ID, user.Role)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	request := func(user models.User, method, path string, body any, want int) json.RawMessage {
		t.Helper()
		if (method == "PATCH" || method == "DELETE") && strings.Contains(path, "/messages/") {
			time.Sleep(350 * time.Millisecond) // Stay below the message action rate limiter.
		}
		data, _ := json.Marshal(body)
		req, err := http.NewRequest(method, server.URL+path, strings.NewReader(string(data)))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token(user))
		// Distinct test identities avoid sharing an IP limiter, without logging tokens or bodies.
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("127.0.1.%d", user.ID%250+1))
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var envelope struct {
			Success bool            `json:"success"`
			Data    json.RawMessage `json:"data"`
			Message string          `json:"message"`
		}
		if err = json.NewDecoder(res.Body).Decode(&envelope); err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != want {
			t.Fatalf("%s %s expected %d got %d: %s", method, path, want, res.StatusCode, envelope.Message)
		}
		return envelope.Data
	}
	p, err := store.PatientByUserID(ctx, patient.ID)
	if err != nil {
		t.Fatal(err)
	}
	op, err := store.PatientByUserID(ctx, other.ID)
	if err != nil {
		t.Fatal(err)
	}
	countProgress := func(want int) {
		t.Helper()
		var data []models.ProgressEntry
		if err = json.Unmarshal(request(patient, "GET", "/api/progress", nil, 200), &data); err != nil {
			t.Fatal(err)
		}
		if len(data) != want {
			t.Fatalf("progress expected %d got %d", want, len(data))
		}
	}
	countProgress(0)
	first, err := store.CreateExam(ctx, p.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	countProgress(1)
	second, err := store.CreateExam(ctx, p.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	countProgress(2)
	foreign, err := store.CreateExam(ctx, op.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	request(patient, "GET", fmt.Sprintf("/api/examinations/%d/comparison", foreign.ID), nil, 404)
	var comparison struct {
		Previous *models.ExaminationDetail `json:"previous"`
	}
	_ = json.Unmarshal(request(patient, "GET", fmt.Sprintf("/api/examinations/%d/comparison", second.ID), nil, 200), &comparison)
	if comparison.Previous == nil || comparison.Previous.Examination.ID != first.ID {
		t.Fatal("previous comparison missing")
	}
	request(provider, "GET", fmt.Sprintf("/api/provider/patients/%d/progress", p.ID), nil, 200)
	request(patient, "GET", fmt.Sprintf("/api/provider/patients/%d/progress", op.ID), nil, 403)
	var conversation models.Conversation
	_ = json.Unmarshal(request(patient, "POST", "/api/conversations", map[string]any{"provider_id": provider.ID, "examination_id": second.ID}, 201), &conversation)
	if conversation.PatientUserID != patient.ID || conversation.ProviderID != provider.ID {
		t.Fatal("conversation identity mismatch")
	}
	base := fmt.Sprintf("/api/conversations/%d", conversation.ID)
	request(patient, "GET", base, nil, 200)
	request(provider, "GET", base, nil, 200)
	request(other, "GET", base, nil, 404)
	request(unrelated, "GET", base, nil, 404)
	request(patient, "POST", "/api/conversations", map[string]any{"provider_id": other.ID}, 404)
	request(patient, "POST", "/api/conversations", map[string]any{"provider_id": provider.ID, "examination_id": foreign.ID}, 404)
	request(patient, "POST", "/api/conversations", map[string]any{"provider_id": provider.ID, "patient_id": op.ID}, 400)
	for _, user := range []models.User{other, unrelated} {
		request(user, "GET", base+"/messages", nil, 404)
		request(user, "POST", base+"/messages", map[string]any{"message": "Forbidden"}, 404)
		request(user, "POST", base+"/read", map[string]any{"through_id": 1}, 404)
	}
	// Store validation is also enforced even if another handler is introduced later.
	if _, err = store.SendMessage(ctx, patient, conversation.ID, " "); err == nil {
		t.Fatal("empty message accepted")
	}
	request(patient, "POST", base+"/messages", map[string]any{"message": "  "}, 400)
	time.Sleep(350 * time.Millisecond)
	request(patient, "POST", base+"/messages", map[string]any{"message": "hello", "sender_id": other.ID}, 400)
	time.Sleep(350 * time.Millisecond)
	var message models.Message
	_ = json.Unmarshal(request(patient, "POST", base+"/messages", map[string]any{"message": "<b>Stored as plain text</b>"}, 201), &message)
	if message.SenderID != patient.ID {
		t.Fatal("sender identity not derived from JWT")
	}
	var messages []models.Message
	_ = json.Unmarshal(request(provider, "GET", base+"/messages", nil, 200), &messages)
	if len(messages) != 1 || messages[0].ReadAt != nil {
		t.Fatal("history/unread mismatch")
	}
	request(provider, "POST", base+"/read", map[string]any{"through_id": message.ID}, 200)
	_ = json.Unmarshal(request(patient, "GET", base+"/messages", nil, 200), &messages)
	if messages[0].ReadAt == nil {
		t.Fatal("read status not persisted")
	}
	for i := 0; i < 52; i++ {
		if _, err = store.SendMessage(ctx, patient, conversation.ID, fmt.Sprint("page ", i)); err != nil {
			t.Fatal(err)
		}
	}
	_ = json.Unmarshal(request(provider, "GET", base+"/messages", nil, 200), &messages)
	if len(messages) != 50 {
		t.Fatal("history is not limited")
	}
	_ = json.Unmarshal(request(provider, "GET", base+"/messages?before="+fmt.Sprint(messages[len(messages)-1].ID), nil, 200), &messages)
	if len(messages) != 3 {
		t.Fatal("older history pagination mismatch")
	}
	messagePath := base + "/messages/" + fmt.Sprint(message.ID)
	for _, user := range []models.User{other, unrelated, provider} {
		request(user, "PATCH", messagePath, map[string]any{"message": "Forbidden edit"}, 404)
		request(user, "DELETE", messagePath, nil, 404)
	}
	for _, text := range []string{" ", strings.Repeat("a", 3001), "bad\x00text"} {
		request(patient, "PATCH", messagePath, map[string]any{"message": text}, 400)
	}
	request(patient, "PATCH", messagePath, map[string]any{"message": "Spoof", "sender_id": provider.ID}, 400)
	request(patient, "PATCH", base+"/messages/invalid", map[string]any{"message": "Invalid"}, 400)
	request(patient, "DELETE", base+"/messages/0", nil, 400)
	if _, err = store.ChangeMessage(ctx, patient, conversation.ID, message.ID, " ", false); err != repositories.ErrTransition {
		t.Fatalf("store accepted empty edit: %v", err)
	}
	var another models.Conversation
	_ = json.Unmarshal(request(patient, "POST", "/api/conversations", map[string]any{"provider_id": provider.ID}, 201), &another)
	request(patient, "PATCH", fmt.Sprintf("/api/conversations/%d/messages/%d", another.ID, message.ID), map[string]any{"message": "Wrong conversation"}, 404)
	var edited models.Message
	_ = json.Unmarshal(request(patient, "PATCH", messagePath, map[string]any{"message": "  Corrected message  "}, 200), &edited)
	if edited.Message != "Corrected message" || edited.EditedAt == nil || edited.ReadAt == nil || !edited.CreatedAt.Equal(message.CreatedAt) {
		t.Fatal("edit did not persist trimmed text, edit time, original creation time and read receipt")
	}
	// Loaded messages outside the newest page must also update on polling/reconnect.
	_ = json.Unmarshal(request(provider, "GET", base+"/messages?since="+fmt.Sprint(message.ID), nil, 200), &messages)
	if len(messages) != 53 || messages[len(messages)-1].Message != "Corrected message" {
		t.Fatal("loaded older message edit was not returned by refresh")
	}
	request(patient, "GET", base+"/messages?since=-1", nil, 400)
	request(patient, "GET", base+"/messages?since=1&before=2", nil, 400)
	var deleted models.Message
	_ = json.Unmarshal(request(patient, "DELETE", messagePath, nil, 200), &deleted)
	if deleted.DeletedAt == nil || deleted.Message != "" {
		t.Fatal("delete did not remove text and persist tombstone")
	}
	request(patient, "PATCH", messagePath, map[string]any{"message": "Restore"}, 404)
	request(patient, "DELETE", messagePath, nil, 404)
	_ = json.Unmarshal(request(provider, "GET", base+"/messages?since="+fmt.Sprint(message.ID), nil, 200), &messages)
	if messages[len(messages)-1].DeletedAt == nil || messages[len(messages)-1].Message != "" {
		t.Fatal("peer can still read deleted text")
	}
	// Provider actions use the same ownership rule and remove unread badges/notices.
	providerMessage, err := store.SendMessage(ctx, provider, another.ID, "Provider message")
	if err != nil {
		t.Fatal(err)
	}
	providerPath := fmt.Sprintf("/api/conversations/%d/messages/%d", another.ID, providerMessage.ID)
	request(patient, "DELETE", providerPath, nil, 404)
	request(provider, "PATCH", providerPath, map[string]any{"message": "Provider correction"}, 200)
	var preview models.Conversation
	_ = json.Unmarshal(request(patient, "GET", fmt.Sprintf("/api/conversations/%d", another.ID), nil, 200), &preview)
	if preview.UnreadCount != 1 || preview.LastMessage == nil || *preview.LastMessage != "Provider correction" {
		t.Fatal("edit did not update conversation preview")
	}
	request(provider, "DELETE", providerPath, nil, 200)
	_ = json.Unmarshal(request(patient, "GET", fmt.Sprintf("/api/conversations/%d", another.ID), nil, 200), &preview)
	if preview.UnreadCount != 0 || preview.LastMessage == nil || *preview.LastMessage != "Pesan dihapus" {
		t.Fatal("delete did not update preview and unread count")
	}
	var unreadNotices int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE conversation_id=$1 AND read_at IS NULL`, another.ID).Scan(&unreadNotices)
	if err != nil || unreadNotices != 0 {
		t.Fatalf("stale unread notices: %d, %v", unreadNotices, err)
	}
	for _, kind := range []string{"message_updated", "message_deleted"} {
		var count int
		err = pool.QueryRow(ctx, `SELECT count(*) FROM realtime_events WHERE kind=$1 AND (payload->>'message_id')::bigint=$2 AND user_id=ANY($3)`, kind, message.ID, []int64{patient.ID, provider.ID}).Scan(&count)
		if err != nil || count != 2 {
			t.Fatalf("%s was not delivered to both participants: %d, %v", kind, count, err)
		}
	}
	var a models.Appointment
	schedule := time.Now().Add(24 * time.Hour).UTC()
	_ = json.Unmarshal(request(patient, "POST", "/api/appointments", map[string]any{"conversation_id": conversation.ID, "scheduled_at": schedule, "notes": "Follow-up"}, 201), &a)
	apath := fmt.Sprintf("/api/appointments/%d", a.ID)
	request(other, "PATCH", apath, map[string]any{"status": "cancelled"}, 404)
	request(unrelated, "PATCH", apath, map[string]any{"status": "confirmed"}, 404)
	request(patient, "PATCH", apath, map[string]any{"status": "confirmed"}, 409)
	request(provider, "PATCH", apath, map[string]any{"status": "confirmed"}, 200)
	request(provider, "PATCH", apath, map[string]any{"status": "completed"}, 409)
	request(patient, "PATCH", apath, map[string]any{"status": "cancelled"}, 200)
	if _, err = store.CreateCall(ctx, patient, conversation.ID, &a.ID); err != repositories.ErrTransition {
		t.Fatalf("cancelled appointment call accepted: %v", err)
	}
	request(provider, "PATCH", apath, map[string]any{"status": "confirmed"}, 409)
	request(patient, "POST", "/api/appointments", map[string]any{"conversation_id": conversation.ID, "scheduled_at": time.Now().Add(-time.Hour)}, 400)
	request(other, "POST", "/api/appointments", map[string]any{"conversation_id": conversation.ID, "scheduled_at": schedule}, 404)
	request(provider, "POST", "/api/appointments", map[string]any{"conversation_id": conversation.ID, "scheduled_at": schedule}, 403)
	secondAppointment, err := store.CreateAppointment(ctx, patient, conversation.ID, schedule, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.UpdateAppointment(ctx, provider, secondAppointment.ID, "confirmed"); err != nil {
		t.Fatal(err)
	}
	overlap, err := store.CreateAppointment(ctx, patient, conversation.ID, schedule.Add(10*time.Minute), "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.UpdateAppointment(ctx, provider, overlap.ID, "confirmed"); err != repositories.ErrTransition {
		t.Fatalf("overlap accepted: %v", err)
	}
	_, err = pool.Exec(ctx, `UPDATE appointments SET scheduled_at=now()-interval '5 minutes' WHERE id=$1`, secondAppointment.ID)
	if err != nil {
		t.Fatal(err)
	}
	request(provider, "PATCH", fmt.Sprintf("/api/appointments/%d", secondAppointment.ID), map[string]any{"status": "completed"}, 200)
	request(other, "POST", "/api/calls", map[string]any{"conversation_id": conversation.ID}, 404)
	time.Sleep(time.Second)
	var call models.CallSession
	_ = json.Unmarshal(request(patient, "POST", "/api/calls", map[string]any{"conversation_id": conversation.ID}, 201), &call)
	callpath := fmt.Sprintf("/api/calls/%d", call.ID)
	request(other, "GET", callpath, nil, 404)
	request(unrelated, "PATCH", callpath, map[string]any{"status": "connecting"}, 404)
	request(patient, "PATCH", callpath, map[string]any{"status": "connecting"}, 409)
	request(provider, "PATCH", callpath, map[string]any{"status": "connected"}, 409)
	if err = store.Signal(ctx, unrelated, call.ID, "call_offer", json.RawMessage(`{"type":"offer","sdp":"test"}`)); err != repositories.ErrNotFound {
		t.Fatal("unrelated signaling accepted")
	}
	if err = store.Signal(ctx, provider, call.ID, "call_offer", json.RawMessage(`{"type":"offer","sdp":"test"}`)); err != repositories.ErrTransition {
		t.Fatal("callee offer accepted")
	}
	request(provider, "PATCH", callpath, map[string]any{"status": "connecting"}, 200)
	request(patient, "PATCH", callpath, map[string]any{"status": "connected"}, 200)
	request(patient, "PATCH", callpath, map[string]any{"status": "ended"}, 200)
	request(provider, "PATCH", callpath, map[string]any{"status": "connected"}, 409)
	if _, err = store.CreateRisk(ctx, models.RiskResult{ExaminationID: first.ID, RiskCategory: "high", Explanation: "Provider assessment"}); err != nil {
		t.Fatal(err)
	}
	if _, err = store.CreateRisk(ctx, models.RiskResult{ExaminationID: second.ID, RiskCategory: "moderate", Explanation: "Stored clinical risk"}); err != nil {
		t.Fatal(err)
	}
	queue, err := store.ReviewQueue(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	firstIndex, secondIndex := -1, -1
	for i, row := range queue {
		if row.ExaminationID == first.ID {
			firstIndex = i
		}
		if row.ExaminationID == second.ID {
			secondIndex = i
		}
	}
	if firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex {
		t.Fatal("high-risk older unreviewed examination not prioritized")
	}
	request(provider, "POST", fmt.Sprintf("/api/provider/examinations/%d/review", second.ID), map[string]any{"notes": "Latest reviewed", "review_status": "approved"}, 200)
	queue, err = store.ReviewQueue(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	firstIndex, secondIndex = -1, -1
	for i, row := range queue {
		if row.ExaminationID == first.ID {
			firstIndex = i
		}
		if row.ExaminationID == second.ID {
			secondIndex = i
		}
	}
	if firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex {
		t.Fatal("older examination lost behind latest approved examination")
	}
	request(patient, "POST", fmt.Sprintf("/api/provider/examinations/%d/review", first.ID), map[string]any{"notes": "Unauthorized", "review_status": "approved"}, 403)
	reviewpath := fmt.Sprintf("/api/provider/examinations/%d/review", first.ID)
	request(provider, "POST", reviewpath, map[string]any{"notes": "Review notes", "conclusion": "Provider conclusion", "followup_recommendation": "Follow-up recommendation", "review_status": "needs_followup"}, 200)
	detail, err := store.ExamDetail(ctx, first.ID)
	if err != nil || detail.MedicalReview == nil || detail.MedicalReview.Conclusion != "Provider conclusion" {
		t.Fatal("review changes not persisted")
	}
	request(provider, "POST", reviewpath, map[string]any{"notes": "Approved", "review_status": "approved"}, 200)
	request(provider, "GET", "/api/provider/review-queue", nil, 200)
	request(patient, "GET", "/api/provider/review-queue", nil, 403)
	request(patient, "GET", "/api/notifications", nil, 200)
	notifications, err := store.Notifications(ctx, patient.ID)
	if err != nil || len(notifications) == 0 {
		t.Fatal("patient notification missing")
	}
	request(other, "POST", fmt.Sprintf("/api/notifications/%d/read", notifications[0].ID), nil, 404)
	request(patient, "POST", fmt.Sprintf("/api/notifications/%d/read", notifications[0].ID), nil, 200)
	request(patient, "GET", "/api/calls/ice-config", nil, 200)
	abandoned, err := store.CreateCall(ctx, patient, conversation.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `UPDATE call_sessions SET created_at=now()-interval '2 minutes' WHERE id=$1`, abandoned.ID); err != nil {
		t.Fatal(err)
	}
	if err = store.ExpireCalls(ctx); err != nil {
		t.Fatal(err)
	}
	abandoned, err = store.Call(ctx, patient, abandoned.ID)
	if err != nil || abandoned.Status != "failed" || abandoned.EndedAt == nil {
		t.Fatal("abandoned call not expired")
	}

	// Socket credentials require JWT, are one-use, and cannot authorize foreign call signaling.
	var ticket struct {
		Ticket string `json:"ticket"`
		Cursor int64  `json:"cursor"`
	}
	_ = json.Unmarshal(request(provider, "POST", "/api/realtime/ticket", nil, 201), &ticket)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/realtime"
	socket, err := websocket.Dial(wsURL, "", origin)
	if err != nil {
		t.Fatal(err)
	}
	defer socket.Close()
	_ = socket.SetDeadline(time.Now().Add(5 * time.Second))
	if err = websocket.JSON.Send(socket, ticket); err != nil {
		t.Fatal(err)
	}
	var event models.RealtimeEvent
	if err = websocket.JSON.Receive(socket, &event); err != nil || event.Kind != "ready" {
		t.Fatalf("socket auth failed: %v", err)
	}
	incoming, err := store.SendMessage(ctx, patient, conversation.ID, "Realtime delivery")
	if err != nil {
		t.Fatal(err)
	}
	if err = websocket.JSON.Receive(socket, &event); err != nil || event.Kind != "message" {
		t.Fatalf("message event not delivered: %v", err)
	}
	var payload struct {
		MessageID int64 `json:"message_id"`
	}
	_ = json.Unmarshal(event.Payload, &payload)
	if payload.MessageID != incoming.ID {
		t.Fatal("wrong realtime message")
	}
	replay, err := websocket.Dial(wsURL, "", origin)
	if err != nil {
		t.Fatal(err)
	}
	defer replay.Close()
	_ = replay.SetDeadline(time.Now().Add(2 * time.Second))
	_ = websocket.JSON.Send(replay, ticket)
	if err = websocket.JSON.Receive(replay, &event); err == nil {
		t.Fatal("replayed ticket accepted")
	}
	if wrong, err := websocket.Dial(wsURL, "", "https://evil.example"); err == nil {
		wrong.Close()
		t.Fatal("foreign origin accepted")
	}
}
