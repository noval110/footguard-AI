package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
)

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func validEmail(value string) bool {
	if len(value) > 255 || strings.ContainsAny(value, " \t\r\n") {
		return false
	}
	parsed, err := mail.ParseAddress(value)
	return err == nil && parsed.Address == value && strings.Contains(value, ".")
}

func (h *Handler) Register(c echo.Context) error {
	var body credentials
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if !required(body.Name, 100) || !validEmail(body.Email) || len(body.Password) < 8 || len(body.Password) > 72 {
		return fail(c, http.StatusBadRequest, "Name, valid email, and password of 8–72 characters are required")
	}
	if body.Role != "" && body.Role != "patient" {
		return fail(c, http.StatusForbidden, "Public registration is for patients only")
	}
	hash, err := h.Auth.Hash(body.Password)
	if err != nil {
		return dbError(c, err)
	}
	user, err := h.Store.CreatePatientUser(c.Request().Context(), body.Name, body.Email, hash)
	if err != nil {
		return dbError(c, err)
	}
	token, err := h.Auth.Token(user.ID, user.Role)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, map[string]any{"user": user, "token": token})
}

func (h *Handler) Login(c echo.Context) error {
	var body credentials
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if !validEmail(body.Email) || body.Password == "" {
		return fail(c, http.StatusBadRequest, "Valid email and password are required")
	}
	user, hash, err := h.Store.AuthByEmail(c.Request().Context(), body.Email)
	if errors.Is(err, repositories.ErrNotFound) || (err == nil && (!user.IsActive || !h.Auth.Check(hash, body.Password))) {
		return fail(c, http.StatusUnauthorized, "Invalid credentials")
	}
	if err != nil {
		return dbError(c, err)
	}
	token, err := h.Auth.Token(user.ID, user.Role)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, map[string]any{"user": user, "token": token})
}

func (h *Handler) GoogleLogin(c echo.Context) error {
	var body struct {
		Credential string `json:"credential"`
	}
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	if body.Credential == "" {
		return fail(c, http.StatusUnauthorized, "Invalid Google credential")
	}
	identity, err := h.GoogleVerifier(c.Request().Context(), body.Credential)
	if errors.Is(err, services.ErrGoogleNotConfigured) || errors.Is(err, services.ErrGoogleVerificationUnavailable) {
		return fail(c, http.StatusServiceUnavailable, "Google sign-in is unavailable")
	}
	if err != nil || identity.Subject == "" || !validEmail(identity.Email) {
		return fail(c, http.StatusUnauthorized, "Invalid Google credential")
	}
	name := strings.TrimSpace(identity.Name)
	if name == "" {
		name = "Pengguna Google"
	}
	if runes := []rune(name); len(runes) > 100 {
		name = string(runes[:100])
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return fail(c, http.StatusInternalServerError, "Internal server error")
	}
	unusableHash, err := h.Auth.Hash(base64.RawURLEncoding.EncodeToString(secret))
	if err != nil {
		return fail(c, http.StatusInternalServerError, "Internal server error")
	}
	user, err := h.Store.FindOrCreateGoogleUser(c.Request().Context(), identity.Subject, identity.Email, name, unusableHash)
	if errors.Is(err, repositories.ErrGoogleAccountUnavailable) || errors.Is(err, repositories.ErrGoogleIdentityConflict) {
		return fail(c, http.StatusUnauthorized, "Invalid Google credential")
	}
	if err != nil {
		return dbError(c, err)
	}
	token, err := h.Auth.Token(user.ID, user.Role)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, map[string]any{"user": user, "token": token})
}

func (h *Handler) Profile(c echo.Context) error {
	return success(c, http.StatusOK, appmiddleware.User(c))
}
