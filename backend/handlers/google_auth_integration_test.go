package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/noval110/footguard/backend/database"
	"github.com/noval110/footguard/backend/handlers"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/services"
)

type authResult struct {
	Success bool `json:"success"`
	Data    struct {
		User  models.User `json:"user"`
		Token string      `json:"token"`
	} `json:"data"`
}

func TestGoogleAndPasswordLoginWithPostgres(t *testing.T) {
	url := os.Getenv("FOOTGUARD_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set FOOTGUARD_TEST_DATABASE_URL to an isolated migrated PostgreSQL database")
	}
	ctx := context.Background()
	pool, err := database.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	store := repositories.New(pool)
	auth := services.NewAuth("integration-test-secret-at-least-32-characters", "test-client-id")
	h := handlers.New(store, auth, "http://127.0.0.1:8000")
	e := echo.New()
	api := e.Group("/api")
	api.POST("/auth/login", h.Login)
	api.POST("/auth/google", h.GoogleLogin)
	authed := api.Group("", appmiddleware.RequireAuth(store, auth))
	authed.GET("/profile", h.Profile)
	authed.GET("/provider/patients", h.ProviderPatients, appmiddleware.RequireRole("provider"))

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	patientEmail := "google-patient-" + suffix + "@example.com"
	providerEmail := "google-provider-" + suffix + "@example.com"
	newEmail := "google-new-" + suffix + "@example.com"
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE email=ANY($1)`, []string{patientEmail, providerEmail, newEmail})
	})
	patientHash, err := auth.Hash("PatientPassword123!")
	if err != nil {
		t.Fatal(err)
	}
	patient, err := store.CreatePatientUser(ctx, "Existing Patient", patientEmail, patientHash)
	if err != nil {
		t.Fatal(err)
	}
	providerHash, err := auth.Hash("ProviderPassword123!")
	if err != nil {
		t.Fatal(err)
	}
	provider, err := store.CreateProviderUser(ctx, "Existing Provider", providerEmail, providerHash)
	if err != nil {
		t.Fatal(err)
	}

	request := func(method, path, body, token string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		if token != "" {
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
		}
		res := httptest.NewRecorder()
		e.ServeHTTP(res, req)
		return res
	}
	login := func(path, body string, expectedID int64, expectedRole string) string {
		t.Helper()
		res := request(http.MethodPost, path, body, "")
		if res.Code != http.StatusOK {
			t.Fatalf("%s returned %d: %s", path, res.Code, res.Body.String())
		}
		var result authResult
		if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if !result.Success || result.Data.User.ID != expectedID || result.Data.User.Role != expectedRole || result.Data.Token == "" {
			t.Fatalf("unexpected auth result for %s: %+v", path, result)
		}
		claims, err := auth.Parse(result.Data.Token)
		if err != nil || claims.UserID != expectedID || claims.Role != expectedRole {
			t.Fatalf("invalid FootGuard JWT: %v", err)
		}
		return result.Data.Token
	}

	// Existing email/password login remains valid for both roles.
	login("/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"PatientPassword123!"}`, patientEmail), patient.ID, "patient")
	login("/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"ProviderPassword123!"}`, providerEmail), provider.ID, "provider")

	h.GoogleVerifier = func(_ context.Context, credential string) (services.GoogleIdentity, error) {
		switch credential {
		case "existing-patient":
			return services.GoogleIdentity{Subject: "sub-patient-" + suffix, Email: patientEmail, Name: "Google Patient"}, nil
		case "existing-provider":
			return services.GoogleIdentity{Subject: "sub-provider-" + suffix, Email: providerEmail, Name: "Google Provider"}, nil
		case "new-patient":
			return services.GoogleIdentity{Subject: "sub-new-" + suffix, Email: newEmail, Name: "New Google Patient"}, nil
		case "renamed-patient":
			return services.GoogleIdentity{Subject: "sub-patient-" + suffix, Email: "renamed-" + suffix + "@example.com", Name: "Renamed Patient"}, nil
		case "conflicting-provider":
			return services.GoogleIdentity{Subject: "another-sub-" + suffix, Email: providerEmail, Name: "Conflicting Provider"}, nil
		default:
			return services.GoogleIdentity{}, services.ErrInvalidGoogleCredential
		}
	}
	patientToken := login("/api/auth/google", `{"credential":"existing-patient"}`, patient.ID, "patient")
	providerToken := login("/api/auth/google", `{"credential":"existing-provider"}`, provider.ID, "provider")
	login("/api/auth/google", `{"credential":"renamed-patient"}`, patient.ID, "patient")
	if res := request(http.MethodPost, "/api/auth/google", `{"credential":"conflicting-provider"}`, ""); res.Code != http.StatusUnauthorized {
		t.Fatalf("different Google subject claimed linked provider: %d", res.Code)
	}
	if res := request(http.MethodPost, "/api/auth/google", `{"credential":"new-patient","role":"provider"}`, ""); res.Code != http.StatusBadRequest {
		t.Fatalf("frontend role field was accepted: %d", res.Code)
	}
	if res := request(http.MethodGet, "/api/provider/patients", "", providerToken); res.Code != http.StatusOK {
		t.Fatalf("existing provider lost access: %d", res.Code)
	}
	if res := request(http.MethodGet, "/api/provider/patients", "", patientToken); res.Code != http.StatusForbidden {
		t.Fatalf("patient entered provider route: %d", res.Code)
	}

	res := request(http.MethodPost, "/api/auth/google", `{"credential":"new-patient"}`, "")
	if res.Code != http.StatusOK {
		t.Fatalf("new Google account returned %d: %s", res.Code, res.Body.String())
	}
	var newResult authResult
	if err := json.Unmarshal(res.Body.Bytes(), &newResult); err != nil {
		t.Fatal(err)
	}
	if newResult.Data.User.Role != "patient" || newResult.Data.User.ID <= 0 || newResult.Data.Token == "" {
		t.Fatalf("new Google account was not a patient: %+v", newResult)
	}
	var storedRole, storedHash, storedSub string
	var patientCount int
	if err := pool.QueryRow(ctx, `SELECT role,password_hash,google_sub FROM users WHERE id=$1`, newResult.Data.User.ID).Scan(&storedRole, &storedHash, &storedSub); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM patients WHERE user_id=$1`, newResult.Data.User.ID).Scan(&patientCount); err != nil {
		t.Fatal(err)
	}
	if storedRole != "patient" || storedSub != "sub-new-"+suffix || storedHash == "" || patientCount != 1 || auth.Check(storedHash, "guess") {
		t.Fatal("new Google account persistence is invalid")
	}
	if res := request(http.MethodGet, "/api/provider/patients", "", newResult.Data.Token); res.Code != http.StatusForbidden {
		t.Fatalf("new Google patient entered provider route: %d", res.Code)
	}
	// Simulate logout by omitting the FootGuard token, then sign in with Google again.
	if res := request(http.MethodGet, "/api/profile", "", ""); res.Code != http.StatusUnauthorized {
		t.Fatalf("logout did not remove access: %d", res.Code)
	}
	login("/api/auth/google", `{"credential":"new-patient"}`, newResult.Data.User.ID, "patient")

	// Google linking does not alter either existing password hash or role.
	var currentHash, currentRole string
	if err := pool.QueryRow(ctx, `SELECT password_hash,role FROM users WHERE id=$1`, provider.ID).Scan(&currentHash, &currentRole); err != nil {
		t.Fatal(err)
	}
	if currentHash != providerHash || currentRole != "provider" {
		t.Fatal("provider password hash or role changed after Google login")
	}
	login("/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"ProviderPassword123!"}`, providerEmail), provider.ID, "provider")
	login("/api/auth/login", fmt.Sprintf(`{"email":%q,"password":"PatientPassword123!"}`, patientEmail), patient.ID, "patient")

	h.GoogleVerifier = auth.VerifyGoogle
	if res := request(http.MethodPost, "/api/auth/google", `{"credential":"invalid-token"}`, ""); res.Code != http.StatusUnauthorized {
		t.Fatalf("invalid Google credential returned %d", res.Code)
	}
}
