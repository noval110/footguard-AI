package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/labstack/echo/v4"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
)

type Handler struct {
	Store          *repositories.Store
	Auth           *services.Auth
	AIServiceURL   string
	AIClient       *http.Client
	UploadDir      string
	AIModelVersion string
	GoogleVerifier func(context.Context, string) (services.GoogleIdentity, error)
}

func New(store *repositories.Store, auth *services.Auth, aiServiceURL string) *Handler {
	return &Handler{Store: store, Auth: auth, AIServiceURL: strings.TrimRight(aiServiceURL, "/"), AIClient: &http.Client{Timeout: 20 * time.Second}, UploadDir: "uploads", AIModelVersion: "best_model.pth", GoogleVerifier: auth.VerifyGoogle}
}

func success(c echo.Context, status int, data any) error {
	return c.JSON(status, map[string]any{"success": true, "data": data})
}
func fail(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]any{"success": false, "message": message})
}

func decode(c echo.Context, dst any) error {
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, 1<<20)
	dec := json.NewDecoder(c.Request().Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return errors.New("only one JSON object is allowed")
	}
	return nil
}

func idParam(c echo.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid ID")
	}
	return id, nil
}

func dbError(c echo.Context, err error) error {
	if errors.Is(err, repositories.ErrNotFound) {
		return fail(c, http.StatusNotFound, "Resource not found")
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return fail(c, http.StatusConflict, "Resource already exists")
		case "23503", "23514", "23502":
			return fail(c, http.StatusBadRequest, "Invalid related data or field value")
		}
	}
	return fail(c, http.StatusInternalServerError, "Internal server error")
}

func validChoice(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}
func required(v string, max int) bool { return strings.TrimSpace(v) != "" && len(v) <= max }
