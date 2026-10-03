# FootGuard backend

Monitoring, secure consultations, appointments, WebSocket delivery, audio calls, migration `005`, environment variables, verification, production deployment, and rollback are documented in [DIA SCAN consultations](../docs/consultations.md). Apply migration `005_monitoring_consultations.sql` after `004` before running the extended backend. The AI service and existing authentication remain compatible.

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
   psql -h localhost -U footguard -d footguard -v ON_ERROR_STOP=1 -f migrations/003_google_identity.sql
   psql -h localhost -U footguard -d footguard -v ON_ERROR_STOP=1 -f migrations/004_neutral_foot_image.sql
   ```

3. Copy `.env.example` to `.env` locally and set a real database password and a random JWT secret of at least 32 characters. Do not commit `.env`.

4. Run:

   ```powershell
   go mod download
   go run ./cmd
   ```

The health endpoint is `GET http://localhost:8080/health`.

### Local troubleshooting

When FastAPI runs locally on port `8000`, set `AI_SERVICE_URL=http://127.0.0.1:8000` in `backend/.env` and restart the backend. An old tunnel URL can cause `502` even when local model loading succeeds. Check `http://127.0.0.1:8000/health` for both `classifier_loaded` and `segmentation_model_loaded`, then run the backend from `C:\footguard\backend` so its relative upload directory resolves correctly.

Neon stores image metadata, not the uploaded image files. Connecting a local backend to Neon does not download the production `UPLOAD_DIR/original` and `UPLOAD_DIR/overlay` files. Missing files return `404`; restore the corresponding upload files from the server or backup to the configured upload directory, preserving their filenames. Existing images cannot be recovered from database metadata alone.

If `/api/conversations` returns `404`, restart the backend with the current source. Missing migration `005` is a separate database issue; check its tables before applying it, and obtain deployment authorization before changing production databases. A `401` on `/api/profile` requires signing in again with a valid session.

If saving a profile photo returns `403` while patient pages still work, check whether the local backend process is an old executable that predates `/api/profile/photo`. A missing route can fall through a role-protected group and return a misleading permission error. Rebuild/restart the local backend from the current source on the actual frontend API port. Tests against a different backend port do not update the running process. Keep the same database, JWT secret, and upload directory; changing roles or removing JWT checks is unnecessary.

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
| `GOOGLE_CLIENT_ID` | Google web OAuth client ID used to verify Google ID tokens; email/password login still works when unset |
| `PROVIDER_PASSWORD` | Only used by the provider provisioning command below |

Public registration creates patient accounts only. Provision a provider through the local CLI after setting `DATABASE_URL` and `PROVIDER_PASSWORD` in the shell:

```powershell
go run ./cmd/create-provider --name "Dr Maya" --email "maya@example.com"
```

### Google Sign-In

Apply `migrations/003_google_identity.sql` to each existing database before deploying the updated backend. Docker's `/docker-entrypoint-initdb.d` scripts run only when the PostgreSQL volume is first created, so an existing Compose database also needs this one-time migration. Do not recreate the volume to apply it.

Set `GOOGLE_CLIENT_ID` to the same Google **Web application** OAuth client ID used by the frontend. `POST /api/auth/google` accepts `{"credential":"<Google ID token>"}` and returns the same `{user, token}` data shape as password login. The server verifies Google's signature, audience, issuer, expiration, and `email_verified` claim before using `sub` and email. Existing accounts retain their stored role and password hash; new Google accounts are patients with an unusable random password hash. Missing Google configuration disables only this endpoint.

## Profile photos

`GET /api/profile` includes `avatar_url` when the signed-in user has a photo. `PUT /api/profile/photo` accepts multipart field `photo` (JPG or PNG, up to 5 MB and 4096 × 4096 pixels); `DELETE /api/profile/photo` removes it. Both return the updated user. `GET /api/profile/photo` serves only the authenticated user's photo with private, no-store caching. The frontend prepares phone-camera orientation, previews the photo, and synchronizes saved changes across the profile, sidebar, and header.

Photos are validated and re-encoded as JPEG, then stored under `UPLOAD_DIR/avatars/<user-id>.jpg`. Keep this directory in the existing persistent upload volume and include it in upload backups. No database migration is required.

## API

All success responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "message": "..." }`. Private endpoints require `Authorization: Bearer <token>`.

| Role | Endpoints |
| --- | --- |
| Public | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `GET /health` |
| Authenticated | `GET /api/profile` |
| Patient | `GET, PUT /api/patients/me`; `POST /api/assessments`; `GET /api/assessments/latest`; `POST, GET /api/examinations`; `POST /api/examinations/:id/analyze`; `POST /api/examinations/analyze` (legacy preview); `GET /api/examinations/:id`; `POST /api/examinations/:id/images` (legacy URL metadata) |
| Patient or provider | `GET /api/examinations/:id/ai-results`; `GET /api/examinations/:id/risk-result`; `GET /api/uploads/:kind/:name` |
| Provider | `POST /api/ai-results`; `POST /api/examinations/:id/risk-result`; `GET /api/provider/patients`; `GET /api/provider/examinations/:id`; `POST /api/provider/examinations/:id/review` |

Patient access to examination resources and stored images is limited to their own records. Providers assign the risk category explicitly; the API does not derive it. `POST /api/ai-results` stores supplied metadata and does not run image analysis. The older `POST /api/examinations/:id/images` route stores a URL only and remains for existing clients.

`POST /api/examinations/:id/analyze` accepts a patient's authenticated multipart `file` and `foot_side` (`foot` for the current single-photo flow; `left` and `right` remain valid for existing clients). It validates JPEG, PNG, or WebP up to 10 MiB, calls FastAPI, saves the original under `UPLOAD_DIR/original` and the decoded JPEG overlay under `UPLOAD_DIR/overlay`, and writes the image, numerical AI result, and completed examination status in one database transaction. Files are removed if persistence fails. The response envelope contains `examination`, `image`, and `ai_result`. The image URLs are private API routes that check the requesting user's role and ownership; use Bearer JWT when loading them. Neither the upload nor overlay base64 is stored in PostgreSQL. Apply migration `004_neutral_foot_image.sql` to existing databases before using the new frontend.

`POST /api/examinations/analyze` remains available as a legacy preview endpoint. It forwards the file and returns the base64 overlay without saving it. New clients should use the examination ID endpoint above. Neither endpoint assigns a clinical risk category. AI service failures return a concise backend error without exposing the upstream body.

### Manual MVP sequence

1. Register a patient with `name`, `email`, and `password`.
2. Use the returned token to `PUT /api/patients/me` with `birth_date` (`YYYY-MM-DD`), `gender`, `diabetes_type`, `diagnosis_year`, and optional `phone`/`address`.
3. `POST /api/assessments` with all six Boolean clinical factors: `has_lops`, `has_pad`, `foot_deformity`, `previous_ulcer`, `previous_amputation`, `kidney_failure`.
4. `POST /api/examinations` with `assessment_id`, then upload one foot photo with multipart `file` and `foot_side=foot` to `POST /api/examinations/:id/analyze`.
5. A provisioned provider may store actual external AI metadata through `POST /api/ai-results`, assign `risk_category` (`low`, `moderate`, `high`) plus `explanation`, and save `review_status` (`pending`, `approved`, `needs_followup`) plus `notes`.
6. The patient can read persisted examination detail, AI values, images, and history after a new session or refresh. The provider can read the complete examination and patient list.

## Verification

```powershell
go test ./...
go vet ./...
```

The Google/password database integration test runs when `FOOTGUARD_TEST_DATABASE_URL` points to an isolated database with migrations `001` through `003` applied. It is skipped when that variable is unset. The test substitutes verified Google claims, so a real Google browser sign-in must also be checked after deployment.

The initial migration was applied successfully to an isolated PostgreSQL 18 database during implementation. A live API smoke test completed the patient and provider sequence and checked unauthorized access. Tests cover password/JWT behavior, protected routes, CORS, and JSON errors.

## ERD and written schema differences

The supplied ERD includes `notifications`, `health_educations`, `user_educations`, and `audit_logs`; the written backend requirements define eight core entities for this MVP, so those four are deferred. The ERD shows an examination level field and risk description/recommendation fields, while the written schema places the categorical outcome in `risk_results.risk_category` with `explanation`; the migration follows the written schema. The written requirements also explicitly allow a nullable `examinations.assessment_id`, which the migration preserves. These differences were kept explicit rather than merged into extra fields or tables.
