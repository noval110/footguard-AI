package handlers

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"os"
	"strconv"
	"strings"
	"time"
)

func (h *Handler) CreateCall(c echo.Context) error {
	var body struct {
		ConversationID int64  `json:"conversation_id"`
		AppointmentID  *int64 `json:"appointment_id"`
	}
	if decode(c, &body) != nil || body.ConversationID <= 0 || body.AppointmentID != nil && *body.AppointmentID <= 0 {
		return fail(c, 400, "Data panggilan tidak valid.")
	}
	result, err := h.Store.CreateCall(c.Request().Context(), appmiddleware.User(c), body.ConversationID, body.AppointmentID)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 201, result)
}
func (h *Handler) Call(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID panggilan tidak valid.")
	}
	result, err := h.Store.Call(c.Request().Context(), appmiddleware.User(c), id)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) Calls(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID percakapan tidak valid.")
	}
	result, err := h.Store.Calls(c.Request().Context(), appmiddleware.User(c), id)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}
func (h *Handler) UpdateCall(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, 400, "ID panggilan tidak valid.")
	}
	var body struct {
		Status string `json:"status"`
	}
	if decode(c, &body) != nil || !validChoice(body.Status, "connecting", "connected", "ended", "failed", "rejected") {
		return fail(c, 400, "Status panggilan tidak valid.")
	}
	result, err := h.Store.UpdateCall(c.Request().Context(), appmiddleware.User(c), id, body.Status)
	if err != nil {
		return consultationError(c, err)
	}
	return success(c, 200, result)
}

// TURN REST credentials are short-lived; the shared server secret never leaves the backend.
func (h *Handler) ICEConfig(c echo.Context) error {
	stun := strings.TrimSpace(os.Getenv("PUBLIC_STUN_URL"))
	if stun == "" {
		stun = "stun:stun.l.google.com:19302"
	}
	servers := []map[string]any{{"urls": []string{stun}}}
	turnURL := strings.TrimSpace(os.Getenv("TURN_URL"))
	secret := os.Getenv("TURN_SHARED_SECRET")
	configured := turnURL != "" && secret != ""
	if configured {
		username := strconv.FormatInt(time.Now().Add(15*time.Minute).Unix(), 10) + ":" + fmt.Sprint(appmiddleware.User(c).ID)
		mac := hmac.New(sha1.New, []byte(secret))
		_, _ = mac.Write([]byte(username))
		servers = append(servers, map[string]any{"urls": strings.Split(turnURL, ","), "username": username, "credential": base64.StdEncoding.EncodeToString(mac.Sum(nil))})
	}
	c.Response().Header().Set("Cache-Control", "no-store")
	return success(c, 200, map[string]any{"ice_servers": servers, "turn_configured": configured})
}
