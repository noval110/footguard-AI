package routes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/noval110/footguard/backend/services"
)

func TestProtectedRouteAndCORS(t *testing.T) {
	e := New(nil, services.NewAuth("a-test-secret-with-at-least-32-characters"), "http://localhost:5173", "http://127.0.0.1:8000")
	request := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", response.Code, response.Body.String())
	}
	analyzeResponse := httptest.NewRecorder()
	e.ServeHTTP(analyzeResponse, httptest.NewRequest(http.MethodPost, "/api/examinations/analyze", nil))
	if analyzeResponse.Code != http.StatusUnauthorized {
		t.Fatalf("analyze route must require authentication, got %d", analyzeResponse.Code)
	}
	preflight := httptest.NewRequest(http.MethodOptions, "/api/profile", nil)
	preflight.Header.Set("Origin", "http://localhost:5173")
	preflight.Header.Set("Access-Control-Request-Method", "GET")
	corsResponse := httptest.NewRecorder()
	e.ServeHTTP(corsResponse, preflight)
	if corsResponse.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatal("frontend origin not allowed")
	}
	unknown := httptest.NewRecorder()
	e.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/missing", nil))
	if unknown.Code != http.StatusNotFound || unknown.Body.String() == "" {
		t.Fatal("unhandled routes must return JSON errors")
	}
	google := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{"credential":""}`))
	google.Header.Set("Content-Type", "application/json")
	googleResponse := httptest.NewRecorder()
	e.ServeHTTP(googleResponse, google)
	if googleResponse.Code != http.StatusUnauthorized {
		t.Fatalf("invalid Google credential must return 401, got %d", googleResponse.Code)
	}
}
