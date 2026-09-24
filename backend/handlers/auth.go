package handlers

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/repositories"
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

func (h *Handler) Profile(c echo.Context) error {
	return success(c, http.StatusOK, appmiddleware.User(c))
}
