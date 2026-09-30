package handlers

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/models"
	"github.com/noval110/footguard/backend/repositories"
)

type examinationInput struct {
	AssessmentID *int64 `json:"assessment_id"`
}

func (h *Handler) CreateExamination(c echo.Context) error {
	var body examinationInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	if body.AssessmentID != nil {
		if *body.AssessmentID <= 0 {
			return fail(c, http.StatusBadRequest, "Invalid assessment_id")
		}
		a, err := h.Store.AssessmentByID(c.Request().Context(), *body.AssessmentID)
		if errors.Is(err, repositories.ErrNotFound) || (err == nil && a.PatientID != p.ID) {
			return fail(c, http.StatusBadRequest, "Assessment does not belong to this patient")
		}
		if err != nil {
			return dbError(c, err)
		}
	}
	e, err := h.Store.CreateExam(c.Request().Context(), p.ID, body.AssessmentID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, e)
}

func (h *Handler) MyExaminations(c echo.Context) error {
	p, err := h.patient(c)
	if err != nil {
		return dbError(c, err)
	}
	items, err := h.Store.ExamsByPatient(c.Request().Context(), p.ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, items)
}

func (h *Handler) authorizedExam(c echo.Context) (models.Examination, error) {
	id, err := idParam(c)
	if err != nil {
		return models.Examination{}, err
	}
	e, err := h.Store.ExamByID(c.Request().Context(), id)
	if err != nil {
		return models.Examination{}, err
	}
	user := appmiddleware.User(c)
	if user.Role == "provider" {
		return e, nil
	}
	if user.Role != "patient" {
		return models.Examination{}, repositories.ErrNotFound
	}
	p, err := h.patient(c)
	if err != nil {
		return models.Examination{}, err
	}
	if p.ID != e.PatientID {
		return models.Examination{}, repositories.ErrNotFound
	}
	return e, nil
}

func (h *Handler) MyExamination(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	d, err := h.Store.ExamDetail(c.Request().Context(), e.ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, d)
}

func examError(c echo.Context, err error) error {
	if err.Error() == "invalid ID" {
		return fail(c, http.StatusBadRequest, "Invalid examination ID")
	}
	return dbError(c, err)
}

type footImageInput struct {
	ImageURL      string `json:"image_url"`
	FootSide      string `json:"foot_side"`
	ImageType     string `json:"image_type"`
	QualityStatus string `json:"quality_status"`
}

func validImageURL(raw string) bool {
	if !required(raw, 2048) {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return u.Scheme == "https" && u.Host != "" || (u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"))
}

func (h *Handler) AddFootImage(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	if appmiddleware.User(c).Role != "patient" {
		return fail(c, http.StatusForbidden, "Patient access required")
	}
	if e.Status != "pending" {
		return fail(c, http.StatusConflict, "Examination is no longer open for images")
	}
	var body footImageInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	if body.ImageType == "" {
		body.ImageType = "photo"
	}
	if body.QualityStatus == "" {
		body.QualityStatus = "pending"
	}
	if !validImageURL(body.ImageURL) || !validChoice(body.FootSide, "left", "right", "foot") || !validChoice(body.ImageType, "photo", "processed", "mask") || !validChoice(body.QualityStatus, "pending", "good", "blurry", "incomplete") {
		return fail(c, http.StatusBadRequest, "Invalid foot image metadata")
	}
	img, err := h.Store.CreateFootImage(c.Request().Context(), models.FootImage{ExaminationID: e.ID, ImageURL: body.ImageURL, FootSide: body.FootSide, ImageType: body.ImageType, QualityStatus: body.QualityStatus})
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, img)
}

type aiResultInput struct {
	FootImageID  int64           `json:"foot_image_id"`
	ModelVersion string          `json:"model_version"`
	FindingType  string          `json:"finding_type"`
	Confidence   *float32        `json:"confidence"`
	MaskURL      *string         `json:"mask_url"`
	BBoxData     json.RawMessage `json:"bbox_data"`
}

func (h *Handler) AddAIResult(c echo.Context) error {
	var body aiResultInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	if body.FootImageID <= 0 || !required(body.ModelVersion, 50) || !required(body.FindingType, 50) || body.Confidence == nil || math.IsNaN(float64(*body.Confidence)) || *body.Confidence < 0 || *body.Confidence > 1 || (body.MaskURL != nil && !validImageURL(*body.MaskURL)) || (len(body.BBoxData) > 0 && !json.Valid(body.BBoxData)) {
		return fail(c, http.StatusBadRequest, "Invalid AI result metadata")
	}
	if _, err := h.Store.FootImageByID(c.Request().Context(), body.FootImageID); err != nil {
		return dbError(c, err)
	}
	v, err := h.Store.CreateAIResult(c.Request().Context(), models.AIResult{FootImageID: body.FootImageID, ModelVersion: strings.TrimSpace(body.ModelVersion), FindingType: strings.TrimSpace(body.FindingType), Confidence: *body.Confidence, MaskURL: body.MaskURL, BBoxData: body.BBoxData})
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, v)
}

func (h *Handler) AIResults(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	items, err := h.Store.AIResultsByExam(c.Request().Context(), e.ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, items)
}

type riskInput struct {
	RiskCategory string `json:"risk_category"`
	Explanation  string `json:"explanation"`
}

func (h *Handler) AddRiskResult(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	if e.AssessmentID == nil {
		return fail(c, http.StatusConflict, "Clinical assessment is required before assigning risk")
	}
	var body riskInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	body.Explanation = strings.TrimSpace(body.Explanation)
	if !validChoice(body.RiskCategory, "low", "moderate", "high") || !required(body.Explanation, 5000) {
		return fail(c, http.StatusBadRequest, "Valid risk_category and explanation are required")
	}
	r, err := h.Store.CreateRisk(c.Request().Context(), models.RiskResult{ExaminationID: e.ID, RiskCategory: body.RiskCategory, Explanation: body.Explanation})
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusCreated, r)
}

func (h *Handler) RiskResult(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	r, err := h.Store.RiskByExam(c.Request().Context(), e.ID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, r)
}

func (h *Handler) ProviderPatients(c echo.Context) error {
	items, err := h.Store.ProviderPatients(c.Request().Context())
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, items)
}

func (h *Handler) ProviderExamination(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, http.StatusBadRequest, "Invalid examination ID")
	}
	d, err := h.Store.ExamDetail(c.Request().Context(), id)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, d)
}

type reviewInput struct {
	Notes        string `json:"notes"`
	ReviewStatus string `json:"review_status"`
}

func (h *Handler) SaveMedicalReview(c echo.Context) error {
	id, err := idParam(c)
	if err != nil {
		return fail(c, http.StatusBadRequest, "Invalid examination ID")
	}
	if _, err := h.Store.ExamByID(c.Request().Context(), id); err != nil {
		return dbError(c, err)
	}
	if _, err := h.Store.RiskByExam(c.Request().Context(), id); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return fail(c, http.StatusConflict, "Risk result is required before review")
		}
		return dbError(c, err)
	}
	var body reviewInput
	if err := decode(c, &body); err != nil {
		return fail(c, http.StatusBadRequest, "Invalid JSON body")
	}
	body.Notes = strings.TrimSpace(body.Notes)
	if !required(body.Notes, 5000) || !validChoice(body.ReviewStatus, "pending", "approved", "needs_followup") {
		return fail(c, http.StatusBadRequest, "Valid notes and review_status are required")
	}
	v, err := h.Store.SaveReview(c.Request().Context(), models.MedicalReview{ExaminationID: id, ReviewerID: appmiddleware.User(c).ID, Notes: body.Notes, ReviewStatus: body.ReviewStatus})
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, v)
}
