package repositories

import (
	"context"
	"github.com/noval110/footguard/backend/models"
)

func (s *Store) Progress(ctx context.Context, patientID int64) ([]models.ProgressEntry, error) {
	// Bound the timeline without downloading full images or issuing one query per examination.
	rows, err := s.DB.Query(ctx, `SELECT e.id,e.patient_id,e.assessment_id,e.status,e.examined_at,e.created_at,e.completed_at,r.risk_category,m.review_status
        FROM examinations e LEFT JOIN risk_results r ON r.examination_id=e.id LEFT JOIN medical_reviews m ON m.examination_id=e.id
        WHERE e.patient_id=$1 ORDER BY e.examined_at DESC,e.id DESC LIMIT 100`, patientID)
	if err != nil {
		return nil, err
	}
	out := make([]models.ProgressEntry, 0)
	ids := make([]int64, 0)
	for rows.Next() {
		var v models.ProgressEntry
		e := &v.Examination
		if err = rows.Scan(&e.ID, &e.PatientID, &e.AssessmentID, &e.Status, &e.ExaminedAt, &e.CreatedAt, &e.CompletedAt, &v.RiskCategory, &v.ReviewStatus); err != nil {
			rows.Close()
			return nil, err
		}
		v.AIResults = make([]models.AIResult, 0)
		out = append(out, v)
		ids = append(ids, e.ID)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return out, nil
	}
	aiRows, err := s.DB.Query(ctx, `SELECT f.examination_id,a.id,a.foot_image_id,a.model_version,a.finding_type,a.confidence,a.ulcer_detected,a.ulcer_area_percent,a.threshold,a.created_at
        FROM ai_results a JOIN foot_images f ON f.id=a.foot_image_id WHERE f.examination_id=ANY($1) ORDER BY a.id`, ids)
	if err != nil {
		return nil, err
	}
	defer aiRows.Close()
	byID := make(map[int64]int)
	for i, v := range out {
		byID[v.Examination.ID] = i
	}
	for aiRows.Next() {
		var id int64
		var a models.AIResult
		if err = aiRows.Scan(&id, &a.ID, &a.FootImageID, &a.ModelVersion, &a.FindingType, &a.Confidence, &a.UlcerDetected, &a.UlcerAreaPercent, &a.Threshold, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.BBoxData = []byte("null")
		i := byID[id]
		out[i].AIResults = append(out[i].AIResults, a)
	}
	return out, aiRows.Err()
}

func (s *Store) PreviousExam(ctx context.Context, e models.Examination) (*models.ExaminationDetail, error) {
	var id int64
	err := s.DB.QueryRow(ctx, `SELECT id FROM examinations WHERE patient_id=$1 AND (examined_at,id)<($2,$3) ORDER BY examined_at DESC,id DESC LIMIT 1`, e.PatientID, e.ExaminedAt, e.ID).Scan(&id)
	if one(err) == ErrNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	detail, err := s.ExamDetail(ctx, id)
	return &detail, err
}

func (s *Store) ReviewQueue(ctx context.Context, offset int64) ([]models.ReviewQueueEntry, error) {
	rows, err := s.DB.Query(ctx, `SELECT e.id,e.patient_id,u.name,e.examined_at,r.risk_category,m.review_status
        FROM examinations e JOIN patients p ON p.id=e.patient_id JOIN users u ON u.id=p.user_id
        LEFT JOIN risk_results r ON r.examination_id=e.id LEFT JOIN medical_reviews m ON m.examination_id=e.id
        WHERE e.status IN ('completed','reviewed')
        ORDER BY CASE WHEN m.review_status IS NULL OR m.review_status='pending' THEN 0 WHEN m.review_status='needs_followup' THEN 1 ELSE 2 END,
        CASE r.risk_category WHEN 'high' THEN 0 WHEN 'moderate' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,e.examined_at,e.id LIMIT 100 OFFSET $1`, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.ReviewQueueEntry, 0)
	for rows.Next() {
		var q models.ReviewQueueEntry
		if err = rows.Scan(&q.ExaminationID, &q.PatientID, &q.PatientName, &q.ExaminedAt, &q.RiskCategory, &q.ReviewStatus); err != nil {
			return nil, err
		}
		out = append(out, q)
	}
	return out, rows.Err()
}
