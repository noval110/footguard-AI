package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
)

const userContextKey = "auth_user"

func User(c echo.Context) models.User { return c.Get(userContextKey).(models.User) }

func RequireAuth(store *repositories.Store, auth *services.Auth) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get(echo.HeaderAuthorization)
			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
				return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Bearer token required"})
			}
			claims, err := auth.Parse(parts[1])
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Invalid or expired token"})
			}
			user, err := store.UserByID(c.Request().Context(), claims.UserID)
			if err != nil || !user.IsActive || user.Role != claims.Role {
				return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Account is unavailable"})
			}
			c.Set(userContextKey, user)
			return next(c)
		}
	}
}

func RequireRole(role string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if User(c).Role != role {
				return c.JSON(http.StatusForbidden, map[string]any{"success": false, "message": "Insufficient permissions"})
			}
			return next(c)
		}
	}
}
