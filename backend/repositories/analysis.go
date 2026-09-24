package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/noval110/footguard/backend/models"
)

var ErrExamClosed = errors.New("examination already reviewed")

func (s *Store) SaveVisualAnalysis(
	ctx context.Context,
	patientID,
	examID int64,
	imageURL,
	side,
	overlayURL,
	modelVersion,
	finding string,
	detected bool,
	area,
	confidence,
	threshold float32,
) (
	models.Examination,
	models.FootImage,
	models.AIResult,
	error,
) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.Examination{},
			models.FootImage{},
			models.AIResult{},
			err
	}

	defer tx.Rollback(ctx)

	var exam models.Examination

	err = tx.QueryRow(
		ctx,
		`SELECT id,patient_id,assessment_id,status,examined_at,created_at,completed_at
		 FROM examinations
		 WHERE id=$1 AND patient_id=$2
		 FOR UPDATE`,
		examID,
		patientID,
	).Scan(
		&exam.ID,
		&exam.PatientID,
		&exam.AssessmentID,
		&exam.Status,
		&exam.ExaminedAt,
		&exam.CreatedAt,
		&exam.CompletedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return exam,
			models.FootImage{},
			models.AIResult{},
			ErrNotFound
	}

	if err != nil {
		return exam,
			models.FootImage{},
			models.AIResult{},
			err
	}

	if exam.Status == "reviewed" {
		return exam,
			models.FootImage{},
			models.AIResult{},
			ErrExamClosed
	}

	var img models.FootImage

	err = tx.QueryRow(
		ctx,
		`INSERT INTO foot_images
			(examination_id,image_url,foot_side,image_type,quality_status)
		 VALUES ($1,$2,$3,'photo','good')
		 RETURNING id,examination_id,image_url,foot_side,image_type,quality_status,created_at`,
		examID,
		imageURL,
		side,
	).Scan(
		&img.ID,
		&img.ExaminationID,
		&img.ImageURL,
		&img.FootSide,
		&img.ImageType,
		&img.QualityStatus,
		&img.CreatedAt,
	)

	if err != nil {
		return exam, img, models.AIResult{}, err
	}

	var ai models.AIResult

	err = tx.QueryRow(
		ctx,
		`INSERT INTO ai_results
			(
				foot_image_id,
				model_version,
				finding_type,
				confidence,
				mask_url,
				ulcer_detected,
				ulcer_area_percent,
				threshold
			)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING
			id,
			foot_image_id,
			model_version,
			finding_type,
			confidence,
			mask_url,
			bbox_data,
			created_at,
			ulcer_detected,
			ulcer_area_percent,
			threshold`,
		img.ID,
		modelVersion,
		finding,
		confidence,
		overlayURL,
		detected,
		area,
		threshold,
	).Scan(
		&ai.ID,
		&ai.FootImageID,
		&ai.ModelVersion,
		&ai.FindingType,
		&ai.Confidence,
		&ai.MaskURL,
		&ai.BBoxData,
		&ai.CreatedAt,
		&ai.UlcerDetected,
		&ai.UlcerAreaPercent,
		&ai.Threshold,
	)

	if err != nil {
		return exam, img, ai, err
	}

	err = tx.QueryRow(
		ctx,
		`UPDATE examinations
		 SET
			status='completed',
			completed_at=COALESCE(completed_at,now()),
			updated_at=now()
		 WHERE id=$1
		 RETURNING status,completed_at`,
		examID,
	).Scan(
		&exam.Status,
		&exam.CompletedAt,
	)

	if err != nil {
		return exam, img, ai, err
	}

	if err := tx.Commit(ctx); err != nil {
		return exam, img, ai, err
	}

	return exam, img, ai, nil
}

func (s *Store) StoredImageOwner(
	ctx context.Context,
	kind,
	url string,
) (int64, error) {
	var userID int64
	var err error

	if kind == "original" {
		err = s.DB.QueryRow(
			ctx,
			`SELECT p.user_id
			 FROM foot_images f
			 JOIN examinations e ON e.id=f.examination_id
			 JOIN patients p ON p.id=e.patient_id
			 WHERE f.image_url=$1`,
			url,
		).Scan(&userID)
	} else {
		err = s.DB.QueryRow(
			ctx,
			`SELECT p.user_id
			 FROM ai_results a
			 JOIN foot_images f ON f.id=a.foot_image_id
			 JOIN examinations e ON e.id=f.examination_id
			 JOIN patients p ON p.id=e.patient_id
			 WHERE a.mask_url=$1`,
			url,
		).Scan(&userID)
	}

	return userID, one(err)
}
