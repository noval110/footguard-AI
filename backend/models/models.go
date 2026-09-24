package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Patient struct {
	ID            int64      `json:"id"`
	UserID        int64      `json:"user_id"`
	BirthDate     *time.Time `json:"birth_date"`
	Gender        *string    `json:"gender"`
	DiabetesType  *string    `json:"diabetes_type"`
	DiagnosisYear *int32     `json:"diagnosis_year"`
	Phone         *string    `json:"phone"`
	Address       *string    `json:"address"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type Assessment struct {
	ID                 int64     `json:"id"`
	PatientID          int64     `json:"patient_id"`
	AssessmentDate     time.Time `json:"assessment_date"`
	HasLOPS            bool      `json:"has_lops"`
	HasPAD             bool      `json:"has_pad"`
	FootDeformity      bool      `json:"foot_deformity"`
	PreviousUlcer      bool      `json:"previous_ulcer"`
	PreviousAmputation bool      `json:"previous_amputation"`
	KidneyFailure      bool      `json:"kidney_failure"`
	Notes              *string   `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
}

type Examination struct {
	ID           int64      `json:"id"`
	PatientID    int64      `json:"patient_id"`
	AssessmentID *int64     `json:"assessment_id"`
	Status       string     `json:"status"`
	ExaminedAt   time.Time  `json:"examined_at"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at"`
}

type FootImage struct {
	ID            int64     `json:"id"`
	ExaminationID int64     `json:"examination_id"`
	ImageURL      string    `json:"image_url"`
	FootSide      string    `json:"foot_side"`
	ImageType     string    `json:"image_type"`
	QualityStatus string    `json:"quality_status"`
	CreatedAt     time.Time `json:"created_at"`
}

type AIResult struct {
	ID               int64           `json:"id"`
	FootImageID      int64           `json:"foot_image_id"`
	ModelVersion     string          `json:"model_version"`
	FindingType      string          `json:"finding_type"`
	Confidence       float32         `json:"confidence"`
	MaskURL          *string         `json:"mask_url"`
	BBoxData         json.RawMessage `json:"bbox_data"`
	CreatedAt        time.Time       `json:"created_at"`
	UlcerDetected    *bool           `json:"ulcer_detected"`
	UlcerAreaPercent *float32        `json:"ulcer_area_percent"`
	Threshold        *float32        `json:"threshold"`
}

type RiskResult struct {
	ID            int64     `json:"id"`
	ExaminationID int64     `json:"examination_id"`
	RiskCategory  string    `json:"risk_category"`
	Explanation   string    `json:"explanation"`
	CreatedAt     time.Time `json:"created_at"`
}

type MedicalReview struct {
	ID            int64     `json:"id"`
	ExaminationID int64     `json:"examination_id"`
	ReviewerID    int64     `json:"reviewer_id"`
	Notes         string    `json:"notes"`
	ReviewStatus  string    `json:"review_status"`
	ReviewedAt    time.Time `json:"reviewed_at"`
	CreatedAt     time.Time `json:"created_at"`
}

type ExaminationDetail struct {
	Examination   Examination    `json:"examination"`
	Patient       Patient        `json:"patient"`
	Assessment    *Assessment    `json:"assessment"`
	FootImages    []FootImage    `json:"foot_images"`
	AIResults     []AIResult     `json:"ai_results"`
	RiskResult    *RiskResult    `json:"risk_result"`
	MedicalReview *MedicalReview `json:"medical_review"`
}

type ProviderPatient struct {
	Patient           Patient        `json:"patient"`
	Name              string         `json:"name"`
	Email             string         `json:"email"`
	LatestExamination *Examination   `json:"latest_examination"`
	LatestRiskResult  *RiskResult    `json:"latest_risk_result"`
	LatestReview      *MedicalReview `json:"latest_review"`
}
