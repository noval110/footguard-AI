# FootGuard backend

Go/Echo API for diabetic foot screening and monitoring. PostgreSQL stores clinical assessments, foot image metadata, visual AI findings, clinical risk results, and medical reviews separately. This service does not diagnose diabetes or calculate a medical risk category.

## Requirements

- Go 1.26.4 (as declared in `go.mod`)
- PostgreSQL 18 (the migration also uses standard PostgreSQL features available in earlier supported versions)

## Setup

From `C:\footguard\backend`:

1. Create a PostgreSQL database and application user. For example, as a PostgreSQL administrator:

   ```sql
   CREATE ROLE footguard LOGIN PASSWORD 'choose-a-local-password';
   CREATE DATABASE footguard OWNER footguard;
   ```

2. Apply the migrations in order:

   ```powershell
   psql -h localhost -U footguard -d footguard -v ON_ERROR_STOP=1 -f migrations/001_init.sql
   psql -h localhost -U footguard -d footguard -v ON_ERROR_STOP=1 -f migrations/002_ai_persistence.sql
   ```

3. Copy `.env.example` to `.env` locally and set a real database password and a random JWT secret of at least 32 characters. Do not commit `.env`.

4. Run:

   ```powershell
   go mod download
   go run ./cmd
   ```

The health endpoint is `GET http://localhost:8080/health`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL, including `sslmode` as appropriate |
| `JWT_SECRET` | Secret for HS256 JWT signing, at least 32 characters |
| `PORT` | HTTP port; defaults to `8080` |
| `FRONTEND_ORIGIN` | Allowed CORS origin; defaults to `http://localhost:5173` |
| `AI_SERVICE_URL` | Base URL of the local FastAPI service; defaults to `http://127.0.0.1:8000` |
| `UPLOAD_DIR` | Local image storage root; defaults to `uploads` relative to the backend process directory |
| `AI_MODEL_VERSION` | Version label stored with each visual result; defaults to `best_model.pth` |
| `PROVIDER_PASSWORD` | Only used by the provider provisioning command below |

Public registration creates patient accounts only. Provision a provider through the local CLI after setting `DATABASE_URL` and `PROVIDER_PASSWORD` in the shell:

```powershell
go run ./cmd/create-provider --name "Dr Maya" --email "maya@example.com"
```

## API

All success responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "message": "..." }`. Private endpoints require `Authorization: Bearer <token>`.

| Role | Endpoints |
| --- | --- |
| Public | `POST /api/auth/register`, `POST /api/auth/login`, `GET /health` |
| Authenticated | `GET /api/profile` |
| Patient | `GET, PUT /api/patients/me`; `POST /api/assessments`; `GET /api/assessments/latest`; `POST, GET /api/examinations`; `POST /api/examinations/:id/analyze`; `POST /api/examinations/analyze` (legacy preview); `GET /api/examinations/:id`; `POST /api/examinations/:id/images` (legacy URL metadata) |
| Patient or provider | `GET /api/examinations/:id/ai-results`; `GET /api/examinations/:id/risk-result`; `GET /api/uploads/:kind/:name` |
| Provider | `POST /api/ai-results`; `POST /api/examinations/:id/risk-result`; `GET /api/provider/patients`; `GET /api/provider/examinations/:id`; `POST /api/provider/examinations/:id/review` |

Patient access to examination resources and stored images is limited to their own records. Providers assign the risk category explicitly; the API does not derive it. `POST /api/ai-results` stores supplied metadata and does not run image analysis. The older `POST /api/examinations/:id/images` route stores a URL only and remains for existing clients.

`POST /api/examinations/:id/analyze` accepts a patient's authenticated multipart `file` and `foot_side` (`left` or `right`). It validates JPEG, PNG, or WebP up to 10 MiB, calls FastAPI, saves the original under `UPLOAD_DIR/original` and the decoded JPEG overlay under `UPLOAD_DIR/overlay`, and writes the image, numerical AI result, and completed examination status in one database transaction. Files are removed if persistence fails. The response envelope contains `examination`, `image`, and `ai_result`. The image URLs are private API routes that check the requesting user's role and ownership; use Bearer JWT when loading them. Neither the upload nor overlay base64 is stored in PostgreSQL. The examination remains open for another foot image until medical review.

`POST /api/examinations/analyze` remains available as a legacy preview endpoint. It forwards the file and returns the base64 overlay without saving it. New clients should use the examination ID endpoint above. Neither endpoint assigns a clinical risk category. AI service failures return a concise backend error without exposing the upstream body.

### Manual MVP sequence

1. Register a patient with `name`, `email`, and `password`.
2. Use the returned token to `PUT /api/patients/me` with `birth_date` (`YYYY-MM-DD`), `gender`, `diabetes_type`, `diagnosis_year`, and optional `phone`/`address`.
3. `POST /api/assessments` with all six Boolean clinical factors: `has_lops`, `has_pad`, `foot_deformity`, `previous_ulcer`, `previous_amputation`, `kidney_failure`.
4. `POST /api/examinations` with `assessment_id`, then upload each foot with multipart `file` and `foot_side` to `POST /api/examinations/:id/analyze`.
5. A provisioned provider may store actual external AI metadata through `POST /api/ai-results`, assign `risk_category` (`low`, `moderate`, `high`) plus `explanation`, and save `review_status` (`pending`, `approved`, `needs_followup`) plus `notes`.
6. The patient can read persisted examination detail, AI values, images, and history after a new session or refresh. The provider can read the complete examination and patient list.

## Verification

```powershell
go test ./...
go vet ./...
```

The initial migration was applied successfully to an isolated PostgreSQL 18 database during implementation. A live API smoke test completed the patient and provider sequence and checked unauthorized access. Tests cover password/JWT behavior, protected routes, CORS, and JSON errors.

## ERD and written schema differences

The supplied ERD includes `notifications`, `health_educations`, `user_educations`, and `audit_logs`; the written backend requirements define eight core entities for this MVP, so those four are deferred. The ERD shows an examination level field and risk description/recommendation fields, while the written schema places the categorical outcome in `risk_results.risk_category` with `explanation`; the migration follows the written schema. The written requirements also explicitly allow a nullable `examinations.assessment_id`, which the migration preserves. These differences were kept explicit rather than merged into extra fields or tables.
