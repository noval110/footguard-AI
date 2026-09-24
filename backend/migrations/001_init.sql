BEGIN;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'provider', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique_lower_idx ON users (lower(email));

CREATE TABLE patients (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    diabetes_type VARCHAR(10) CHECK (diabetes_type IN ('type1', 'type2', 'other')),
    diagnosis_year INTEGER CHECK (diagnosis_year BETWEEN 1900 AND 2100),
    phone VARCHAR(30),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    has_lops BOOLEAN NOT NULL,
    has_pad BOOLEAN NOT NULL,
    foot_deformity BOOLEAN NOT NULL,
    previous_ulcer BOOLEAN NOT NULL,
    previous_amputation BOOLEAN NOT NULL,
    kidney_failure BOOLEAN NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, patient_id)
);
CREATE INDEX assessments_patient_date_idx ON assessments (patient_id, assessment_date DESC, id DESC);

CREATE TABLE examinations (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed')),
    examined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (assessment_id, patient_id) REFERENCES assessments(id, patient_id)
);
CREATE INDEX examinations_patient_date_idx ON examinations (patient_id, examined_at DESC, id DESC);
CREATE INDEX examinations_status_date_idx ON examinations (status, examined_at DESC);

CREATE TABLE foot_images (
    id BIGSERIAL PRIMARY KEY,
    examination_id BIGINT NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
    image_url VARCHAR(2048) NOT NULL,
    foot_side VARCHAR(5) NOT NULL CHECK (foot_side IN ('left', 'right')),
    image_type VARCHAR(20) NOT NULL DEFAULT 'photo' CHECK (image_type IN ('photo', 'processed', 'mask')),
    quality_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (quality_status IN ('pending', 'good', 'blurry', 'incomplete')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX foot_images_examination_idx ON foot_images (examination_id);

CREATE TABLE ai_results (
    id BIGSERIAL PRIMARY KEY,
    foot_image_id BIGINT NOT NULL REFERENCES foot_images(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    finding_type VARCHAR(50) NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    mask_url VARCHAR(2048),
    bbox_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_results_foot_image_idx ON ai_results (foot_image_id);

CREATE TABLE risk_results (
    id BIGSERIAL PRIMARY KEY,
    examination_id BIGINT NOT NULL UNIQUE REFERENCES examinations(id) ON DELETE CASCADE,
    risk_category VARCHAR(10) NOT NULL CHECK (risk_category IN ('low', 'moderate', 'high')),
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medical_reviews (
    id BIGSERIAL PRIMARY KEY,
    examination_id BIGINT NOT NULL UNIQUE REFERENCES examinations(id) ON DELETE CASCADE,
    reviewer_id BIGINT NOT NULL REFERENCES users(id),
    notes TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('pending', 'approved', 'needs_followup')),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX medical_reviews_reviewer_idx ON medical_reviews (reviewer_id, reviewed_at DESC);

COMMIT;
