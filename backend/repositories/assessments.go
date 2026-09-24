package repositories

import (
	"context"

	"github.com/noval110/footguard/backend/models"
)

func (s *Store) CreateAssessment(ctx context.Context, a models.Assessment) (models.Assessment, error) {
	var out models.Assessment
	err := s.DB.QueryRow(ctx, `INSERT INTO assessments (patient_id,assessment_date,has_lops,has_pad,foot_deformity,previous_ulcer,previous_amputation,kidney_failure,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,patient_id,assessment_date,has_lops,has_pad,foot_deformity,previous_ulcer,previous_amputation,kidney_failure,notes,created_at`, a.PatientID, a.AssessmentDate, a.HasLOPS, a.HasPAD, a.FootDeformity, a.PreviousUlcer, a.PreviousAmputation, a.KidneyFailure, a.Notes).Scan(&out.ID, &out.PatientID, &out.AssessmentDate, &out.HasLOPS, &out.HasPAD, &out.FootDeformity, &out.PreviousUlcer, &out.PreviousAmputation, &out.KidneyFailure, &out.Notes, &out.CreatedAt)
	return out, err
}

func (s *Store) AssessmentByID(ctx context.Context, id int64) (models.Assessment, error) {
	var a models.Assessment
	err := s.DB.QueryRow(ctx, `SELECT id,patient_id,assessment_date,has_lops,has_pad,foot_deformity,previous_ulcer,previous_amputation,kidney_failure,notes,created_at FROM assessments WHERE id=$1`, id).Scan(&a.ID, &a.PatientID, &a.AssessmentDate, &a.HasLOPS, &a.HasPAD, &a.FootDeformity, &a.PreviousUlcer, &a.PreviousAmputation, &a.KidneyFailure, &a.Notes, &a.CreatedAt)
	return a, one(err)
}

func (s *Store) LatestAssessment(ctx context.Context, patientID int64) (models.Assessment, error) {
	var a models.Assessment
	err := s.DB.QueryRow(ctx, `SELECT id,patient_id,assessment_date,has_lops,has_pad,foot_deformity,previous_ulcer,previous_amputation,kidney_failure,notes,created_at FROM assessments WHERE patient_id=$1 ORDER BY assessment_date DESC,id DESC LIMIT 1`, patientID).Scan(&a.ID, &a.PatientID, &a.AssessmentDate, &a.HasLOPS, &a.HasPAD, &a.FootDeformity, &a.PreviousUlcer, &a.PreviousAmputation, &a.KidneyFailure, &a.Notes, &a.CreatedAt)
	return a, one(err)
}
