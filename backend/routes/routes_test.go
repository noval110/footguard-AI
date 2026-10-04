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

func TestConsultationEndpointsRequireJWT(t *testing.T) {
	e := New(nil, services.NewAuth("a-test-secret-with-at-least-32-characters"), "http://localhost:5173", "http://127.0.0.1:8000")
	for _, route := range []struct{ method, path string }{
		{"GET", "/api/conversations"}, {"POST", "/api/conversations"}, {"GET", "/api/conversations/1/messages"}, {"POST", "/api/conversations/1/messages"}, {"POST", "/api/conversations/1/read"},
		{"PATCH", "/api/conversations/1/messages/1"}, {"DELETE", "/api/conversations/1/messages/1"},
		{"GET", "/api/appointments"}, {"POST", "/api/appointments"}, {"PATCH", "/api/appointments/1"}, {"POST", "/api/calls"}, {"PATCH", "/api/calls/1"},
		{"GET", "/api/calls/ice-config"}, {"POST", "/api/realtime/ticket"}, {"GET", "/api/progress"}, {"GET", "/api/provider/review-queue"}, {"GET", "/api/notifications"},
	} {
		response := httptest.NewRecorder()
		e.ServeHTTP(response, httptest.NewRequest(route.method, route.path, nil))
		if response.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: got %d", route.method, route.path, response.Code)
		}
	}
	preflight := httptest.NewRequest("OPTIONS", "/api/appointments/1", nil)
	preflight.Header.Set("Origin", "http://localhost:5173")
	preflight.Header.Set("Access-Control-Request-Method", "PATCH")
	response := httptest.NewRecorder()
	e.ServeHTTP(response, preflight)
	if !strings.Contains(response.Header().Get("Access-Control-Allow-Methods"), "PATCH") {
		t.Fatal("PATCH CORS not enabled")
	}
}

func TestProfilePhotoRoutesRequireJWTAndAllowDeleteCORS(t *testing.T) {
	e := New(nil, services.NewAuth("a-test-secret-with-at-least-32-characters"), "http://localhost:5173", "http://127.0.0.1:8000")
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		response := httptest.NewRecorder()
		e.ServeHTTP(response, httptest.NewRequest(method, "/api/profile/photo", nil))
		if response.Code != http.StatusUnauthorized {
			t.Errorf("%s photo endpoint: expected 401, got %d", method, response.Code)
		}
	}
	preflight := httptest.NewRequest(http.MethodOptions, "/api/profile/photo", nil)
	preflight.Header.Set("Origin", "http://localhost:5173")
	preflight.Header.Set("Access-Control-Request-Method", http.MethodDelete)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, preflight)
	if !strings.Contains(response.Header().Get("Access-Control-Allow-Methods"), http.MethodDelete) {
		t.Fatal("DELETE CORS not enabled")
	}
}
