package routes

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/noval110/footguard/backend/handlers"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
)

func New(store *repositories.Store, auth *services.Auth, frontendOrigin, aiServiceURL string, storage ...string) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		status := http.StatusInternalServerError
		message := "Internal server error"
		var echoError *echo.HTTPError
		if errors.As(err, &echoError) {
			status = echoError.Code
			if status < 500 {
				message = http.StatusText(status)
			}
		}
		_ = c.JSON(status, map[string]any{"success": false, "message": message})
	}
	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.Logger())
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{AllowOrigins: []string{frontendOrigin}, AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodOptions}, AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization}}))
	e.Use(echoMiddleware.Secure())
	h := handlers.New(store, auth, aiServiceURL)
	if len(storage) > 0 {
		h.UploadDir = storage[0]
	}
	if len(storage) > 1 {
		h.AIModelVersion = storage[1]
	}
	e.GET("/health", func(c echo.Context) error {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
		defer cancel()
		if err := store.Health(ctx); err != nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]any{"success": false, "message": "Database unavailable"})
		}
		return c.JSON(http.StatusOK, map[string]any{"success": true, "data": map[string]string{"status": "ok"}})
	})
	api := e.Group("/api")
	api.POST("/auth/register", h.Register)
	api.POST("/auth/login", h.Login)
	authed := api.Group("", appmiddleware.RequireAuth(store, auth))
	authed.GET("/profile", h.Profile)
	patient := authed.Group("", appmiddleware.RequireRole("patient"))
	patient.GET("/patients/me", h.MyPatient)
	patient.PUT("/patients/me", h.UpdateMyPatient)
	patient.POST("/assessments", h.CreateAssessment)
	patient.GET("/assessments/latest", h.LatestAssessment)
	patient.POST("/examinations", h.CreateExamination)
	patient.POST("/examinations/analyze", h.AnalyzeFootImage)
	patient.POST("/examinations/:id/analyze", h.AnalyzeAndPersistFootImage)
	authed.GET("/uploads/:kind/:name", h.ServeUploadedImage)
	patient.GET("/examinations", h.MyExaminations)
	patient.GET("/examinations/:id", h.MyExamination)
	patient.POST("/examinations/:id/images", h.AddFootImage)
	authed.GET("/examinations/:id/ai-results", h.AIResults)
	authed.GET("/examinations/:id/risk-result", h.RiskResult)
	provider := authed.Group("", appmiddleware.RequireRole("provider"))
	provider.POST("/ai-results", h.AddAIResult)
	provider.POST("/examinations/:id/risk-result", h.AddRiskResult)
	provider.GET("/provider/patients", h.ProviderPatients)
	provider.GET("/provider/examinations/:id", h.ProviderExamination)
	provider.POST("/provider/examinations/:id/review", h.SaveMedicalReview)
	return e
}
