package services

import (
	"github.com/noval110/footguard/backend/models"
	"strings"
	"unicode/utf8"
)

const MaxMessageLength = 3000

func ValidMessage(message string) bool {
	return utf8.ValidString(message) && strings.TrimSpace(message) != "" && utf8.RuneCountInString(message) <= MaxMessageLength && !strings.ContainsRune(message, 0)
}

func ConversationParticipant(user models.User, conversation models.Conversation) bool {
	return user.IsActive && (user.Role == "patient" && user.ID == conversation.PatientUserID || user.Role == "provider" && user.ID == conversation.ProviderID)
}

func AppointmentTransition(role, from, to string) bool {
	if to == "cancelled" && (from == "requested" || from == "confirmed") {
		return role == "patient" || role == "provider"
	}
	return role == "provider" && (from == "requested" && to == "confirmed" || from == "confirmed" && to == "completed")
}

func CallTransition(from, to string, caller bool) bool {
	switch to {
	case "connecting":
		return from == "calling" && !caller
	case "connected":
		return from == "connecting"
	case "rejected":
		return from == "calling" && !caller
	case "ended", "failed":
		return from == "calling" || from == "connecting" || from == "connected"
	}
	return false
}
