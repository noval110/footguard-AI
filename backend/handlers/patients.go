package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/repositories"
)

type patientUpdate struct {
	BirthDate     string `json:"birth_date"`
	Gender        string `json:"gender"`
	DiabetesType  string `json:"diabetes_type"`
	DiagnosisYear int32  `json:"diagnosis_year"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
}

func (h *Handler) patient(c echo.Context) (models.Patient, error) {
	return h.Store.PatientByUserID(c.Request().Context(), appmiddleware.User(c).ID)
}

func (h *Handler) MyPatient(c echo.Context) error {
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, p)
}

func (h *Handler) UpdateMyPatient(c echo.Context) error {
	var body patientUpdate
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	birth, err := repositories.ParseDate(body.BirthDate)
	if err != nil || birth.After(time.Now()) || !validChoice(body.Gender, "male", "female", "other") || !validChoice(body.DiabetesType, "type1", "type2", "other") || body.DiagnosisYear < 1900 || body.DiagnosisYear > int32(time.Now().Year()) || len(body.Phone) > 30 || len(body.Address) > 5000 {
		return fail(c, http.StatusBadRequest, "Invalid patient profile fields")
	}
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	p.BirthDate = &birth
	p.Gender = &body.Gender
	p.DiabetesType = &body.DiabetesType
	p.DiagnosisYear = &body.DiagnosisYear
	phone := strings.TrimSpace(body.Phone)
	address := strings.TrimSpace(body.Address)
	p.Phone = &phone
	p.Address = &address
	updated, err := h.Store.UpdatePatient(c.Request().Context(), p)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, updated)
}

type assessmentInput struct {
	AssessmentDate     string `json:"assessment_date"`
	HasLOPS            *bool  `json:"has_lops"`
	HasPAD             *bool  `json:"has_pad"`
	FootDeformity      *bool  `json:"foot_deformity"`
	PreviousUlcer      *bool  `json:"previous_ulcer"`
	PreviousAmputation *bool  `json:"previous_amputation"`
	KidneyFailure      *bool  `json:"kidney_failure"`
	Notes              string `json:"notes"`
}

func (h *Handler) CreateAssessment(c echo.Context) error {
	var body assessmentInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	if body.HasLOPS == nil || body.HasPAD == nil || body.FootDeformity == nil || body.PreviousUlcer == nil || body.PreviousAmputation == nil || body.KidneyFailure == nil || len(body.Notes) > 5000 {
		return fail(c, http.StatusBadRequest, "All clinical factors are required")
	}
	date := time.Now().UTC()
	if body.AssessmentDate != "" {
		parsed, err := repositories.ParseDate(body.AssessmentDate)
		if err != nil {
			return fail(c, http.StatusBadRequest, "assessment_date must use YYYY-MM-DD")
		}
		date = parsed
	}
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	notes := strings.TrimSpace(body.Notes)
	a, err := h.Store.CreateAssessment(c.Request().Context(), models.Assessment{PatientID: p.ID, AssessmentDate: date, HasLOPS: *body.HasLOPS, HasPAD: *body.HasPAD, FootDeformity: *body.FootDeformity, PreviousUlcer: *body.PreviousUlcer, PreviousAmputation: *body.PreviousAmputation, KidneyFailure: *body.KidneyFailure, Notes: &notes})
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, a)
}

func (h *Handler) LatestAssessment(c echo.Context) error {
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	a, err := h.Store.LatestAssessment(c.Request().Context(), p.ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, a)
}
