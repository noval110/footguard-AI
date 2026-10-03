package repositories

import (
	"context"
	"encoding/json"

	"github.com/noval110/footguard/backend/models"
)

func (s *Store) CreateExam(ctx context.Context, patientID int64, assessmentID *int64) (models.Examination, error) {
	var e models.Examination
	err := s.DB.QueryRow(ctx, `INSERT INTO examinations (patient_id,assessment_id) VALUES ($1,$2) RETURNING id,patient_id,assessment_id,status,examined_at,created_at,completed_at`, patientID, assessmentID).Scan(&e.ID, &e.PatientID, &e.AssessmentID, &e.Status, &e.ExaminedAt, &e.CreatedAt, &e.CompletedAt)
	return e, err
}

func (s *Store) ExamByID(ctx context.Context, id int64) (models.Examination, error) {
	var e models.Examination
	err := s.DB.QueryRow(ctx, `SELECT id,patient_id,assessment_id,status,examined_at,created_at,completed_at FROM examinations WHERE id=$1`, id).Scan(&e.ID, &e.PatientID, &e.AssessmentID, &e.Status, &e.ExaminedAt, &e.CreatedAt, &e.CompletedAt)
	return e, one(err)
}

func (s *Store) LatestExamByPatient(ctx context.Context, patientID int64) (models.Examination, error) {
	var e models.Examination
	err := s.DB.QueryRow(ctx, `SELECT id,patient_id,assessment_id,status,examined_at,created_at,completed_at FROM examinations WHERE patient_id=$1 ORDER BY examined_at DESC,id DESC LIMIT 1`, patientID).Scan(&e.ID, &e.PatientID, &e.AssessmentID, &e.Status, &e.ExaminedAt, &e.CreatedAt, &e.CompletedAt)
	return e, one(err)
}

func (s *Store) ExamsByPatient(ctx context.Context, patientID int64) ([]models.Examination, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,patient_id,assessment_id,status,examined_at,created_at,completed_at FROM examinations WHERE patient_id=$1 ORDER BY examined_at DESC,id DESC LIMIT 100`, patientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Examination, 0)
	for rows.Next() {
		var e models.Examination
		if err := rows.Scan(&e.ID, &e.PatientID, &e.AssessmentID, &e.Status, &e.ExaminedAt, &e.CreatedAt, &e.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) CreateFootImage(ctx context.Context, img models.FootImage) (models.FootImage, error) {
	var out models.FootImage
	err := s.DB.QueryRow(ctx, `INSERT INTO foot_images (examination_id,image_url,foot_side,image_type,quality_status) VALUES ($1,$2,$3,$4,$5) RETURNING id,examination_id,image_url,foot_side,image_type,quality_status,created_at`, img.ExaminationID, img.ImageURL, img.FootSide, img.ImageType, img.QualityStatus).Scan(&out.ID, &out.ExaminationID, &out.ImageURL, &out.FootSide, &out.ImageType, &out.QualityStatus, &out.CreatedAt)
	return out, err
}

func (s *Store) FootImageByID(ctx context.Context, id int64) (models.FootImage, error) {
	var out models.FootImage
	err := s.DB.QueryRow(ctx, `SELECT id,examination_id,image_url,foot_side,image_type,quality_status,created_at FROM foot_images WHERE id=$1`, id).Scan(&out.ID, &out.ExaminationID, &out.ImageURL, &out.FootSide, &out.ImageType, &out.QualityStatus, &out.CreatedAt)
	return out, one(err)
}

func (s *Store) ImagesByExam(ctx context.Context, examID int64) ([]models.FootImage, error) {
	rows, err := s.DB.Query(ctx, `SELECT id,examination_id,image_url,foot_side,image_type,quality_status,created_at FROM foot_images WHERE examination_id=$1 ORDER BY id`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.FootImage, 0)
	for rows.Next() {
		var v models.FootImage
		if err := rows.Scan(&v.ID, &v.ExaminationID, &v.ImageURL, &v.FootSide, &v.ImageType, &v.QualityStatus, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) CreateAIResult(ctx context.Context, v models.AIResult) (models.AIResult, error) {
	var out models.AIResult
	var bbox any
	if len(v.BBoxData) > 0 {
		bbox = []byte(v.BBoxData)
	}
	err := s.DB.QueryRow(ctx, `INSERT INTO ai_results (foot_image_id,model_version,finding_type,confidence,mask_url,bbox_data,ulcer_detected,ulcer_area_percent,threshold) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,foot_image_id,model_version,finding_type,confidence,mask_url,bbox_data,created_at,ulcer_detected,ulcer_area_percent,threshold`, v.FootImageID, v.ModelVersion, v.FindingType, v.Confidence, v.MaskURL, bbox, v.UlcerDetected, v.UlcerAreaPercent, v.Threshold).Scan(&out.ID, &out.FootImageID, &out.ModelVersion, &out.FindingType, &out.Confidence, &out.MaskURL, &out.BBoxData, &out.CreatedAt, &out.UlcerDetected, &out.UlcerAreaPercent, &out.Threshold)
	return out, err
}

func (s *Store) AIResultsByExam(ctx context.Context, examID int64) ([]models.AIResult, error) {
	rows, err := s.DB.Query(ctx, `SELECT a.id,a.foot_image_id,a.model_version,a.finding_type,a.confidence,a.mask_url,a.bbox_data,a.created_at,a.ulcer_detected,a.ulcer_area_percent,a.threshold FROM ai_results a JOIN foot_images f ON f.id=a.foot_image_id WHERE f.examination_id=$1 ORDER BY a.id`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.AIResult, 0)
	for rows.Next() {
		var v models.AIResult
		if err := rows.Scan(&v.ID, &v.FootImageID, &v.ModelVersion, &v.FindingType, &v.Confidence, &v.MaskURL, &v.BBoxData, &v.CreatedAt, &v.UlcerDetected, &v.UlcerAreaPercent, &v.Threshold); err != nil {
			return nil, err
		}
		if len(v.BBoxData) == 0 {
			v.BBoxData = json.RawMessage("null")
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) CreateRisk(ctx context.Context, v models.RiskResult) (models.RiskResult, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.RiskResult{}, err
	}
	defer tx.Rollback(ctx)
	var out models.RiskResult
	err = tx.QueryRow(ctx, `INSERT INTO risk_results (examination_id,risk_category,explanation) VALUES ($1,$2,$3) RETURNING id,examination_id,risk_category,explanation,created_at`, v.ExaminationID, v.RiskCategory, v.Explanation).Scan(&out.ID, &out.ExaminationID, &out.RiskCategory, &out.Explanation, &out.CreatedAt)
	if err != nil {
		return models.RiskResult{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE examinations SET status='completed',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=$1`, v.ExaminationID); err != nil {
		return models.RiskResult{}, err
	}
	return out, tx.Commit(ctx)
}

func (s *Store) RiskByExam(ctx context.Context, examID int64) (models.RiskResult, error) {
	var v models.RiskResult
	err := s.DB.QueryRow(ctx, `SELECT id,examination_id,risk_category,explanation,created_at FROM risk_results WHERE examination_id=$1`, examID).Scan(&v.ID, &v.ExaminationID, &v.RiskCategory, &v.Explanation, &v.CreatedAt)
	return v, one(err)
}

func (s *Store) SaveReview(ctx context.Context, v models.MedicalReview) (models.MedicalReview, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.MedicalReview{}, err
	}
	defer tx.Rollback(ctx)
	var out models.MedicalReview
	err = tx.QueryRow(ctx, `INSERT INTO medical_reviews (examination_id,reviewer_id,notes,review_status,conclusion,followup_recommendation) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (examination_id) DO UPDATE SET reviewer_id=EXCLUDED.reviewer_id,notes=EXCLUDED.notes,review_status=EXCLUDED.review_status,conclusion=EXCLUDED.conclusion,followup_recommendation=EXCLUDED.followup_recommendation,reviewed_at=now(),updated_at=now() RETURNING id,examination_id,reviewer_id,notes,review_status,reviewed_at,created_at,conclusion,followup_recommendation`, v.ExaminationID, v.ReviewerID, v.Notes, v.ReviewStatus, v.Conclusion, v.FollowupRecommendation).Scan(&out.ID, &out.ExaminationID, &out.ReviewerID, &out.Notes, &out.ReviewStatus, &out.ReviewedAt, &out.CreatedAt, &out.Conclusion, &out.FollowupRecommendation)
	if err != nil {
		return models.MedicalReview{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE examinations SET status='reviewed',updated_at=now() WHERE id=$1`, v.ExaminationID); err != nil {
		return models.MedicalReview{}, err
	}
	var patientUserID int64
	if err = tx.QueryRow(ctx, `SELECT p.user_id FROM examinations e JOIN patients p ON p.id=e.patient_id WHERE e.id=$1`, v.ExaminationID).Scan(&patientUserID); err != nil {
		return out, err
	}
	if err = notify(ctx, tx, patientUserID, "examination_reviewed", nil, &v.ExaminationID); err != nil {
		return out, err
	}
	if err = emit(ctx, tx, []int64{patientUserID}, "examination_reviewed", map[string]any{"examination_id": v.ExaminationID}, false); err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}

func (s *Store) ReviewByExam(ctx context.Context, examID int64) (models.MedicalReview, error) {
	var v models.MedicalReview
	err := s.DB.QueryRow(ctx, `SELECT id,examination_id,reviewer_id,notes,review_status,reviewed_at,created_at,conclusion,followup_recommendation FROM medical_reviews WHERE examination_id=$1`, examID).Scan(&v.ID, &v.ExaminationID, &v.ReviewerID, &v.Notes, &v.ReviewStatus, &v.ReviewedAt, &v.CreatedAt, &v.Conclusion, &v.FollowupRecommendation)
	return v, one(err)
}

func (s *Store) ExamDetail(ctx context.Context, id int64) (models.ExaminationDetail, error) {
	e, err := s.ExamByID(ctx, id)
	if err != nil {
		return models.ExaminationDetail{}, err
	}
	p, err := s.PatientByID(ctx, e.PatientID)
	if err != nil {
		return models.ExaminationDetail{}, err
	}
	d := models.ExaminationDetail{Examination: e, Patient: p, FootImages: []models.FootImage{}, AIResults: []models.AIResult{}}
	if e.AssessmentID != nil {
		a, err := s.AssessmentByID(ctx, *e.AssessmentID)
		if err != nil {
			return d, err
		}
		d.Assessment = &a
	}
	if d.FootImages, err = s.ImagesByExam(ctx, id); err != nil {
		return d, err
	}
	if d.AIResults, err = s.AIResultsByExam(ctx, id); err != nil {
		return d, err
	}
	if r, rerr := s.RiskByExam(ctx, id); rerr == nil {
		d.RiskResult = &r
	} else if rerr != ErrNotFound {
		return d, rerr
	}
	if r, rerr := s.ReviewByExam(ctx, id); rerr == nil {
		d.MedicalReview = &r
	} else if rerr != ErrNotFound {
		return d, rerr
	}
	return d, nil
}
