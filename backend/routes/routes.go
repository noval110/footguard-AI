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
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{AllowOrigins: []string{frontendOrigin}, AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions}, AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization}}))
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
	api.POST("/auth/google", h.GoogleLogin)
	api.GET("/realtime", h.Realtime(frontendOrigin), echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(2)))
	authed := api.Group("", appmiddleware.RequireAuth(store, auth))
	authed.GET("/profile", h.Profile)
	authed.GET("/profile/photo", h.ProfilePhoto)
	authed.PUT("/profile/photo", h.UpdateProfilePhoto)
	authed.DELETE("/profile/photo", h.DeleteProfilePhoto)
	consultation := authed.Group("", appmiddleware.RequireCareRole())
	consultation.POST("/realtime/ticket", h.RealtimeTicket, echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(2)))
	consultation.GET("/conversations", h.Conversations)
	consultation.POST("/conversations", h.CreateConversation)
	consultation.GET("/conversations/:id", h.Conversation)
	consultation.GET("/conversations/:id/messages", h.Messages)
	consultation.POST("/conversations/:id/messages", h.SendMessage, echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(3)))
	consultation.POST("/conversations/:id/read", h.ReadMessages)
	consultation.GET("/appointments", h.Appointments)
	consultation.PATCH("/appointments/:id", h.UpdateAppointment)
	consultation.POST("/calls", h.CreateCall, echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(1)))
	consultation.GET("/calls/:id", h.Call)
	consultation.PATCH("/calls/:id", h.UpdateCall)
	consultation.GET("/conversations/:id/calls", h.Calls)
	consultation.GET("/calls/ice-config", h.ICEConfig)
	consultation.GET("/notifications", h.Notifications)
	consultation.POST("/notifications/:id/read", h.ReadNotification)
	patient := authed.Group("", appmiddleware.RequireRole("patient"))
	patient.GET("/patients/me", h.MyPatient)
	patient.GET("/progress", h.Progress)
	patient.GET("/consultation/providers", h.ConsultationProviders)
	patient.POST("/appointments", h.CreateAppointment)
	patient.PUT("/patients/me", h.UpdateMyPatient)
	patient.POST("/assessments", h.CreateAssessment)
	patient.GET("/assessments/latest", h.LatestAssessment)
	patient.POST("/examinations", h.CreateExamination)
	patient.POST("/examinations/analyze", h.AnalyzeFootImage)
	patient.POST("/examinations/:id/analyze", h.AnalyzeAndPersistFootImage)
	authed.GET("/uploads/:kind/:name", h.ServeUploadedImage)
	patient.GET("/examinations", h.MyExaminations)
	patient.GET("/examinations/:id", h.MyExamination)
	authed.GET("/examinations/:id/comparison", h.Comparison)
	patient.POST("/examinations/:id/images", h.AddFootImage)
	authed.GET("/examinations/:id/ai-results", h.AIResults)
	authed.GET("/examinations/:id/risk-result", h.RiskResult)
	provider := authed.Group("", appmiddleware.RequireRole("provider"))
	provider.POST("/ai-results", h.AddAIResult)
	provider.POST("/examinations/:id/risk-result", h.AddRiskResult)
	provider.GET("/provider/patients", h.ProviderPatients)
	provider.GET("/provider/patients/:id/progress", h.Progress)
	provider.GET("/provider/review-queue", h.ReviewQueue)
	provider.GET("/provider/examinations/:id", h.ProviderExamination)
	provider.POST("/provider/examinations/:id/review", h.SaveMedicalReview)
	return e
}
