package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"golang.org/x/net/websocket"
	"golang.org/x/time/rate"
	"net/http"
	"strings"
	"time"
)

func ticketHash(ticket string) string {
	hash := sha256.Sum256([]byte(ticket))
	return hex.EncodeToString(hash[:])
}

func (h *Handler) RealtimeTicket(c echo.Context) error {
	raw := strings.SplitN(c.Request().Header.Get("Authorization"), " ", 2)
	if len(raw) != 2 {
		return fail(c, 401, "Sesi tidak valid.")
	}
	claims, err := h.Auth.Parse(raw[1])
	if err != nil {
		return fail(c, 401, "Sesi tidak valid.")
	}
	bytes := make([]byte, 32)
	if _, err = rand.Read(bytes); err != nil {
		return dbError(c, err)
	}
	ticket := hex.EncodeToString(bytes)
	cursor, err := h.Store.CreateRealtimeTicket(c.Request().Context(), ticketHash(ticket), appmiddleware.User(c).ID, claims.ExpiresAt.Time)
	if err != nil {
		return dbError(c, err)
	}
	c.Response().Header().Set("Cache-Control", "no-store")
	return success(c, 201, map[string]any{"ticket": ticket, "cursor": cursor})
}

type socketInput struct {
	Kind   string          `json:"kind"`
	CallID int64           `json:"call_id"`
	Data   json.RawMessage `json:"data"`
}

func validSignal(input socketInput) bool {
	if input.CallID <= 0 || len(input.Data) > 48<<10 || !json.Valid(input.Data) {
		return false
	}
	var data struct {
		Type      string  `json:"type"`
		SDP       string  `json:"sdp"`
		Candidate *string `json:"candidate"`
	}
	if json.Unmarshal(input.Data, &data) != nil {
		return false
	}
	switch input.Kind {
	case "call_offer":
		return data.Type == "offer" && data.SDP != "" && !strings.Contains(data.SDP, "m=video")
	case "call_answer":
		return data.Type == "answer" && data.SDP != "" && !strings.Contains(data.SDP, "m=video")
	case "ice_candidate":
		return data.Candidate != nil && len(*data.Candidate) < 8192
	}
	return false
}

func (h *Handler) Realtime(frontendOrigin string) echo.HandlerFunc {
	return func(c echo.Context) error {
		if c.Request().Header.Get("Origin") != frontendOrigin {
			return fail(c, http.StatusForbidden, "Origin tidak diizinkan.")
		}
		server := websocket.Server{
			Handshake: func(config *websocket.Config, r *http.Request) error {
				if r.Header.Get("Origin") != frontendOrigin {
					return errors.New("invalid origin")
				}
				return nil
			},
			Handler: func(conn *websocket.Conn) { h.socket(conn) },
		}
		server.ServeHTTP(c.Response(), c.Request())
		return nil
	}
}

func (h *Handler) socket(conn *websocket.Conn) {
	defer conn.Close()
	conn.MaxPayloadBytes = 64 << 10
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var hello struct {
		Ticket string `json:"ticket"`
		Cursor int64  `json:"cursor"`
	}
	if websocket.JSON.Receive(conn, &hello) != nil || len(hello.Ticket) != 64 || hello.Cursor < 0 {
		return
	}
	user, expiry, err := h.Store.ConsumeRealtimeTicket(ctx, ticketHash(hello.Ticket))
	if err != nil {
		return
	}
	send := func(value any) error {
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		return websocket.JSON.Send(conn, value)
	}
	if send(map[string]any{"kind": "ready"}) != nil {
		return
	}
	input := make(chan socketInput, 32)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_ = conn.SetReadDeadline(time.Now().Add(45 * time.Second))
			var message socketInput
			if websocket.JSON.Receive(conn, &message) != nil {
				return
			}
			select {
			case input <- message:
			case <-ctx.Done():
				return
			}
		}
	}()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	limiter := rate.NewLimiter(10, 30)
	cursor := hello.Cursor
	checks := 0
	for {
		select {
		case <-done:
			return
		case message := <-input:
			if !limiter.Allow() {
				return
			}
			if message.Kind == "ping" {
				continue
			}
			if message.Kind == "call_heartbeat" {
				if h.Store.HeartbeatCall(ctx, user, message.CallID) != nil {
					_ = send(map[string]any{"kind": "call_error", "payload": map[string]any{"call_id": message.CallID}})
				}
				continue
			}
			if !validSignal(message) || h.Store.Signal(ctx, user, message.CallID, message.Kind, message.Data) != nil {
				if send(map[string]any{"kind": "call_error", "payload": map[string]any{"call_id": message.CallID}}) != nil {
					return
				}
			}
		case <-ticker.C:
			if time.Now().After(expiry) {
				return
			}
			checks++
			if checks%15 == 0 {
				if h.Store.ExpireCalls(ctx) != nil {
					return
				}
			}
			if checks%30 == 0 {
				current, err := h.Store.UserByID(ctx, user.ID)
				if err != nil || !current.IsActive || current.Role != user.Role {
					return
				}
			}
			events, err := h.Store.RealtimeEvents(ctx, user.ID, cursor)
			if err != nil {
				return
			}
			for _, event := range events {
				if send(event) != nil {
					return
				}
				cursor = event.ID
			}
		}
	}
}
