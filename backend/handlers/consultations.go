package handlers

import (
	"errors"
	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

func consultationError(c echo.Context, err error) error {
	if errors.Is(err, repositories.ErrTransition) {
		return fail(c, http.StatusConflict, "Status atau jadwal konsultasi tidak dapat diubah.")
	}
	if errors.Is(err, repositories.ErrNotFound) {
		return fail(c, http.StatusNotFound, "Konsultasi tidak tersedia atau Anda tidak memiliki akses.")
	}
	return dbError(c, err)
}
func (h *Handler) Conversations(c echo.Context) error {
	result, err := h.Store.Conversations(c.Request().Context(), appmiddleware.User(c))
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, http.StatusOK, result)
}
func (h *Handler) Conversation(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID percakapan tidak valid.")
	}
	result, err := h.Store.Conversation(c.Request().Context(), appmiddleware.User(c), id)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) CreateConversation(c echo.Context) error {
	var body struct {
		PatientID     int64  `json:"patient_id"`
		ProviderID    int64  `json:"provider_id"`
		ExaminationID *int64 `json:"examination_id"`
	}
	if decode(c, &body) != nil || body.ExaminationID != nil && *body.ExaminationID <= 0 {
		return fail(c, 400, "Data percakapan tidak valid.")
	}
	user := appmiddleware.User(c)
	if user.Role == "patient" && (body.PatientID != 0 || body.ProviderID <= 0) || user.Role == "provider" && (body.ProviderID != 0 || body.PatientID <= 0) {
		return fail(c, 400, "Pilih peserta konsultasi yang sesuai.")
	}
	result, err := h.Store.CreateConversation(c.Request().Context(), user, body.PatientID, body.ProviderID, body.ExaminationID)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 201, result)
}
func (h *Handler) ConsultationProviders(c echo.Context) error {
	result, err := h.Store.ConsultationProviders(c.Request().Context())
	if err != nil {
		return dbError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) Messages(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID percakapan tidak valid.")
	}
	var before int64
	if value := c.QueryParam("before"); value != "" {
		before, err = strconv.ParseInt(value, 10, 64)
		if err != nil || before <= 0 {
			return fail(c, 400, "Halaman pesan tidak valid.")
		}
	}
	var since int64
	if value := c.QueryParam("since"); value != "" {
		since, err = strconv.ParseInt(value, 10, 64)
		if err != nil || since <= 0 || before != 0 {
			return fail(c, 400, "Batas pembaruan pesan tidak valid.")
		}
	}
	result, err := h.Store.Messages(c.Request().Context(), appmiddleware.User(c), id, before, since)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) SendMessage(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID percakapan tidak valid.")
	}
	var body struct {
		Message string `json:"message"`
	}
	if decode(c, &body) != nil || !services.ValidMessage(body.Message) {
		return fail(c, 400, "Pesan harus berisi 1–3000 karakter.")
	}
	result, err := h.Store.SendMessage(c.Request().Context(), appmiddleware.User(c), id, body.Message)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 201, result)
}
func (h *Handler) UpdateMessage(c echo.Context) error {
	return h.changeMessage(c, false)
}

func (h *Handler) DeleteMessage(c echo.Context) error {
	return h.changeMessage(c, true)
}

func (h *Handler) changeMessage(c echo.Context, remove bool) error {
	id, err := idParam(c)
	messageID, messageErr := strconv.ParseInt(c.Param("message_id"), 10, 64)
	if err != nil || messageErr != nil || messageID <= 0 {
		return fail(c, 400, "ID percakapan atau pesan tidak valid.")
	}
	var body struct {
		Message string `json:"message"`
	}
	if !remove && (decode(c, &body) != nil || !services.ValidMessage(body.Message)) {
		return fail(c, 400, "Pesan harus berisi 1–3000 karakter.")
	}
	result, err := h.Store.ChangeMessage(c.Request().Context(), appmiddleware.User(c), id, messageID, body.Message, remove)
	if errors.Is(err, repositories.ErrNotFound) {
		return fail(c, 404, "Pesan tidak tersedia atau Anda tidak memiliki akses.")
	}
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}

func (h *Handler) ReadMessages(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID percakapan tidak valid.")
	}
	var body struct {
		ThroughID int64 `json:"through_id"`
	}
	if decode(c, &body) != nil || body.ThroughID <= 0 {
		return fail(c, 400, "Batas pesan tidak valid.")
	}
	if err = h.Store.ReadMessages(c.Request().Context(), appmiddleware.User(c), id, body.ThroughID); err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, map[string]bool{"read": true})
}
func (h *Handler) Appointments(c echo.Context) error {
	result, err := h.Store.Appointments(c.Request().Context(), appmiddleware.User(c))
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) CreateAppointment(c echo.Context) error {
	var body struct {
		ConversationID int64     `json:"conversation_id"`
		ScheduledAt    time.Time `json:"scheduled_at"`
		Notes          string    `json:"notes"`
	}
	now := time.Now()
	if decode(c, &body) != nil || body.ConversationID <= 0 || !body.ScheduledAt.After(now) || body.ScheduledAt.After(now.AddDate(1, 0, 0)) || utf8.RuneCountInString(body.Notes) > 3000 || strings.ContainsRune(body.Notes, 0) {
		return fail(c, 400, "Pilih jadwal mendatang dalam satu tahun dan catatan maksimal 3000 karakter.")
	}
	result, err := h.Store.CreateAppointment(c.Request().Context(), appmiddleware.User(c), body.ConversationID, body.ScheduledAt, strings.TrimSpace(body.Notes))
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 201, result)
}
func (h *Handler) UpdateAppointment(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID jadwal tidak valid.")
	}
	var body struct {
		Status string `json:"status"`
	}
	if decode(c, &body) != nil || !validChoice(body.Status, "confirmed", "cancelled", "completed") {
		return fail(c, 400, "Status jadwal tidak valid.")
	}
	result, err := h.Store.UpdateAppointment(c.Request().Context(), appmiddleware.User(c), id, body.Status)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) Notifications(c echo.Context) error {
	result, err := h.Store.Notifications(c.Request().Context(), appmiddleware.User(c).ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) ReadNotification(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID notifikasi tidak valid.")
	}
	if err = h.Store.ReadNotification(c.Request().Context(), appmiddleware.User(c).ID, id); err != nil {
		return dbError(c, err)
	}
	return success(c, 200, map[string]bool{"read": true})
}
