package services

import (
	"github.com/noval110/footguard/backend/models"
	"strings"
	"testing"
)

func TestConversationParticipant(t *testing.T) {
	c := models.Conversation{PatientUserID: 10, ProviderID: 20}
	cases := []struct {
		role         string
		id           int64
		active, want bool
	}{
		{"patient", 10, true, true}, {"patient", 11, true, false}, {"provider", 20, true, true}, {"provider", 21, true, false},
		{"patient", 20, true, false}, {"provider", 10, true, false}, {"admin", 20, true, false}, {"patient", 10, false, false},
	}
	for _, tc := range cases {
		if got := ConversationParticipant(models.User{ID: tc.id, Role: tc.role, IsActive: tc.active}, c); got != tc.want {
			t.Errorf("role=%s id=%d active=%v got %v", tc.role, tc.id, tc.active, got)
		}
	}
}
func TestMessageValidation(t *testing.T) {
	for _, tc := range []struct {
		input string
		want  bool
	}{{"Halo", true}, {"<script>alert('text')</script>", true}, {strings.Repeat("界", 3000), true}, {strings.Repeat("界", 3001), false}, {"", false}, {" \n\t", false}, {"hello\x00", false}, {string([]byte{0xff}), false}} {
		if ValidMessage(tc.input) != tc.want {
			t.Errorf("message validation length %d", len(tc.input))
		}
	}
}
func TestAppointmentTransitions(t *testing.T) {
	for _, tc := range []struct {
		role, from, to string
		want           bool
	}{
		{"patient", "requested", "confirmed", false}, {"provider", "requested", "confirmed", true}, {"patient", "confirmed", "completed", false},
		{"provider", "confirmed", "completed", true}, {"patient", "requested", "cancelled", true}, {"patient", "confirmed", "cancelled", true},
		{"provider", "requested", "cancelled", true}, {"provider", "completed", "cancelled", false}, {"provider", "cancelled", "confirmed", false}, {"admin", "requested", "cancelled", false},
	} {
		if got := AppointmentTransition(tc.role, tc.from, tc.to); got != tc.want {
			t.Errorf("%+v got %v", tc, got)
		}
	}
}
func TestCallTransitions(t *testing.T) {
	for _, tc := range []struct {
		from, to     string
		caller, want bool
	}{
		{"calling", "connecting", false, true}, {"calling", "connecting", true, false}, {"calling", "connected", false, false}, {"connecting", "connected", true, true},
		{"calling", "rejected", false, true}, {"calling", "rejected", true, false}, {"connected", "ended", true, true}, {"calling", "failed", true, true},
		{"ended", "connected", false, false}, {"failed", "calling", true, false}, {"connected", "connecting", false, false},
	} {
		if got := CallTransition(tc.from, tc.to, tc.caller); got != tc.want {
			t.Errorf("%+v got %v", tc, got)
		}
	}
}
