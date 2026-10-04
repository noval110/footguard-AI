package models

import (
	"encoding/json"
	"time"
)

type Conversation struct {
	ID            int64     `json:"id"`
	PatientID     int64     `json:"patient_id"`
	PatientUserID int64     `json:"patient_user_id"`
	ProviderID    int64     `json:"provider_id"`
	ExaminationID *int64    `json:"examination_id"`
	PatientName   string    `json:"patient_name"`
	ProviderName  string    `json:"provider_name"`
	LastMessage   *string   `json:"last_message"`
	UnreadCount   int64     `json:"unread_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Message struct {
	ID             int64      `json:"id"`
	ConversationID int64      `json:"conversation_id"`
	SenderID       int64      `json:"sender_id"`
	SenderName     string     `json:"sender_name"`
	Message        string     `json:"message"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at"`
	EditedAt       *time.Time `json:"edited_at"`
	DeletedAt      *time.Time `json:"deleted_at"`
}

type Appointment struct {
	ID             int64     `json:"id"`
	ConversationID int64     `json:"conversation_id"`
	ScheduledAt    time.Time `json:"scheduled_at"`
	Status         string    `json:"status"`
	Notes          string    `json:"notes"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	PatientName    string    `json:"patient_name"`
	ProviderName   string    `json:"provider_name"`
	ExaminationID  *int64    `json:"examination_id"`
}

type CallSession struct {
	ID             int64      `json:"id"`
	ConversationID int64      `json:"conversation_id"`
	AppointmentID  *int64     `json:"appointment_id"`
	CallerID       int64      `json:"caller_id"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	StartedAt      *time.Time `json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`
}

type RealtimeEvent struct {
	ID      int64           `json:"id"`
	Kind    string          `json:"kind"`
	Payload json.RawMessage `json:"payload"`
}

type Notification struct {
	ID             int64      `json:"id"`
	Kind           string     `json:"kind"`
	ConversationID *int64     `json:"conversation_id"`
	ExaminationID  *int64     `json:"examination_id"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at"`
}

type ProgressEntry struct {
	Examination  Examination `json:"examination"`
	RiskCategory *string     `json:"risk_category"`
	ReviewStatus *string     `json:"review_status"`
	AIResults    []AIResult  `json:"ai_results"`
}

type ReviewQueueEntry struct {
	ExaminationID int64     `json:"examination_id"`
	PatientID     int64     `json:"patient_id"`
	PatientName   string    `json:"patient_name"`
	ExaminedAt    time.Time `json:"examined_at"`
	RiskCategory  *string   `json:"risk_category"`
	ReviewStatus  *string   `json:"review_status"`
}
