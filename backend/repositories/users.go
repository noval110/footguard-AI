package repositories

import (
	"context"
	"strings"
	"time"

	"github.com/noval110/footguard/backend/models"
)

func (s *Store) CreatePatientUser(ctx context.Context, name, email, hash string) (models.User, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx)
	var u models.User
	err = tx.QueryRow(ctx, `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'patient') RETURNING id,name,email,role,is_active,created_at`, name, strings.ToLower(email), hash).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		return models.User{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO patients (user_id) VALUES ($1)`, u.ID); err != nil {
		return models.User{}, err
	}
	return u, tx.Commit(ctx)
}

func (s *Store) CreateProviderUser(ctx context.Context, name, email, hash string) (models.User, error) {
	var u models.User
	err := s.DB.QueryRow(ctx, `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'provider') RETURNING id,name,email,role,is_active,created_at`, name, strings.ToLower(email), hash).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	return u, err
}

func (s *Store) AuthByEmail(ctx context.Context, email string) (models.User, string, error) {
	var u models.User
	var hash string
	err := s.DB.QueryRow(ctx, `SELECT id,name,email,role,is_active,created_at,password_hash FROM users WHERE lower(email)=lower($1)`, email).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &hash)
	return u, hash, one(err)
}

func (s *Store) UserByID(ctx context.Context, id int64) (models.User, error) {
	var u models.User
	err := s.DB.QueryRow(ctx, `SELECT id,name,email,role,is_active,created_at FROM users WHERE id=$1`, id).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	return u, one(err)
}

func (s *Store) PatientByUserID(ctx context.Context, userID int64) (models.Patient, error) {
	var p models.Patient
	err := s.DB.QueryRow(ctx, `SELECT id,user_id,birth_date,gender,diabetes_type,diagnosis_year,phone,address,created_at,updated_at FROM patients WHERE user_id=$1`, userID).Scan(&p.ID, &p.UserID, &p.BirthDate, &p.Gender, &p.DiabetesType, &p.DiagnosisYear, &p.Phone, &p.Address, &p.CreatedAt, &p.UpdatedAt)
	return p, one(err)
}

func (s *Store) PatientByID(ctx context.Context, id int64) (models.Patient, error) {
	var p models.Patient
	err := s.DB.QueryRow(ctx, `SELECT id,user_id,birth_date,gender,diabetes_type,diagnosis_year,phone,address,created_at,updated_at FROM patients WHERE id=$1`, id).Scan(&p.ID, &p.UserID, &p.BirthDate, &p.Gender, &p.DiabetesType, &p.DiagnosisYear, &p.Phone, &p.Address, &p.CreatedAt, &p.UpdatedAt)
	return p, one(err)
}

func (s *Store) UpdatePatient(ctx context.Context, p models.Patient) (models.Patient, error) {
	var updated models.Patient
	err := s.DB.QueryRow(ctx, `UPDATE patients SET birth_date=$2,gender=$3,diabetes_type=$4,diagnosis_year=$5,phone=$6,address=$7,updated_at=now() WHERE id=$1 RETURNING id,user_id,birth_date,gender,diabetes_type,diagnosis_year,phone,address,created_at,updated_at`, p.ID, p.BirthDate, p.Gender, p.DiabetesType, p.DiagnosisYear, p.Phone, p.Address).Scan(&updated.ID, &updated.UserID, &updated.BirthDate, &updated.Gender, &updated.DiabetesType, &updated.DiagnosisYear, &updated.Phone, &updated.Address, &updated.CreatedAt, &updated.UpdatedAt)
	return updated, one(err)
}

func (s *Store) ProviderPatients(ctx context.Context) ([]models.ProviderPatient, error) {
	rows, err := s.DB.Query(ctx, `SELECT p.id,p.user_id,p.birth_date,p.gender,p.diabetes_type,p.diagnosis_year,p.phone,p.address,p.created_at,p.updated_at,u.name,u.email FROM patients p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]models.ProviderPatient, 0)
	for rows.Next() {
		var item models.ProviderPatient
		p := &item.Patient
		if err := rows.Scan(&p.ID, &p.UserID, &p.BirthDate, &p.Gender, &p.DiabetesType, &p.DiagnosisYear, &p.Phone, &p.Address, &p.CreatedAt, &p.UpdatedAt, &item.Name, &item.Email); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range result {
		e, err := s.LatestExamByPatient(ctx, result[i].Patient.ID)
		if err == ErrNotFound {
			continue
		}
		if err != nil {
			return nil, err
		}
		result[i].LatestExamination = &e
		risk, err := s.RiskByExam(ctx, e.ID)
		if err == nil {
			result[i].LatestRiskResult = &risk
		} else if err != ErrNotFound {
			return nil, err
		}
		review, err := s.ReviewByExam(ctx, e.ID)
		if err == nil {
			result[i].LatestReview = &review
		} else if err != ErrNotFound {
			return nil, err
		}
	}
	return result, nil
}

func ParseDate(value string) (time.Time, error) { return time.Parse("2006-01-02", value) }
