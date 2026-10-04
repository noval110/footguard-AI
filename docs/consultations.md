# DIA SCAN monitoring and consultations

DIA SCAN membantu skrining dan pemantauan kaki diabetik. Hasil AI tidak menggantikan pemeriksaan tenaga kesehatan.

This extension uses the existing React/Vite frontend, Echo/Go backend, pgx/PostgreSQL repositories, and FootGuard JWT. The Python inference service and model weights are unchanged. No Firebase, Supabase, Socket.IO, extra authentication service, or new npm dependency is introduced. Go's existing `golang.org/x/net/websocket` and `golang.org/x/time/rate` dependencies are used directly.

## Existing schema and access model

`patients.user_id` references `users.id`. Providers are active `users` with `role='provider'`; there is no separate provider or patient assignment table. The existing review directory grants providers access to all patients/examinations. That convention is preserved for reviews, monitoring, comparison, and protected images. Communication is narrower: only the patient and the specifically selected provider can access a conversation, its messages, appointments, or calls. Administrators receive no communication access.

Patients can choose an active provider in Konsultasi. Providers can start a conversation from the existing patient directory or an examination. Optional examination context must belong to that patient. Identity is derived from JWT and stored participants, not caller-supplied sender IDs or roles. The backend rejects unrelated patient/provider requests with 404, avoiding disclosure of resource existence.

## Migration

Apply **`backend/migrations/005_monitoring_consultations.sql`** once, after migrations 001–004. Existing migration history has not been edited by this feature.

The migration adds seven tables:

| Table | Columns and purpose |
| --- | --- |
| `conversations` | `id`, `patient_id` (patients), `provider_id` (users), optional `examination_id`, `created_at`, `updated_at` |
| `messages` | `id`, `conversation_id`, `sender_id` (users), `message`, `created_at`, `read_at`; 1–3000 characters |
| `appointments` | `id`, `conversation_id`, `scheduled_at`, `status`, `notes`, `created_at`, `updated_at` |
| `call_sessions` | `id`, `conversation_id`, optional `appointment_id`, `caller_id`, `status`, `created_at`, `started_at`, `ended_at`, `updated_at`; metadata only |
| `realtime_tickets` | SHA-256 `token_hash`, `user_id`, `expires_at`, `session_expires_at`; no stored JWT |
| `realtime_events` | `id`, recipient `user_id`, `kind`, JSON `payload`, `expires_at`; metadata and temporary signaling |
| `notifications` | `id`, `user_id`, `kind`, optional `conversation_id`/`examination_id`, `created_at`, `read_at` |

`medical_reviews` gains `conclusion` and `followup_recommendation`, both non-null text with empty-string defaults. Original `notes` and review statuses remain compatible. Appointment and call participants are derived through `conversation_id` instead of duplicating identity columns.

Indexes cover conversation participant/activity lookup; unique patient/provider/examination context (including null context); descending message history; unread messages; consultation schedules; call history and one active call per conversation; ticket expiry; event recipient/cursor and expiry; notification history and unread lookup. Existing examination history indexes are reused. All new identity references have foreign keys. Existing users, Google identities, examinations, and AI results are retained.

The migration is additive and compatible with the previous application version. Older review writers will leave the new review fields intact on updates, but will not populate them. The new backend requires 005 to be applied before it starts serving the feature routes. Do not claim Neon has changed until its migration is actually executed and checked.

For an existing database, set `PGSERVICE`/`PGSERVICEFILE` or local libpq settings without putting passwords in shell history:

```powershell
psql -v ON_ERROR_STOP=1 -f backend/migrations/005_monitoring_consultations.sql
```

Docker's init-directory migrations only run on a new PostgreSQL volume. Apply 005 manually to an existing volume; do not delete or recreate the production volume.

## Monitoring and reviews

Patient: `/patient/progress`. Provider: `/provider/patients/:id/progress`.

The timeline shows up to 100 recent examinations and their actual stored risk category, AI classification/confidence, marked-area percentage when available, and review status. No synthetic metric, new model, medical scoring formula, image difference algorithm, or automatic worsening conclusion is added. Each AI result remains separate, avoiding an invented average across images. Risk remains categorical. With one examination the UI explicitly says two are needed; with none it shows an empty state. Differences between the latest available stored classification/area or risk entries generate only neutral wording. Photo angle, framing, lighting, and model differences can affect comparability.

Users can compare any selected examination with its immediately preceding examination. Both images and stored overlays use the existing protected image loader. Desktop panels are side by side; mobile panels stack. Missing photos, overlays, reviews, or earlier examinations are shown as missing.

`/provider/review-queue` includes every completed/reviewed examination, including older examinations that are not a patient's latest. Workflow order is unreviewed/pending first by high, moderate, low, then unassigned risk; needs-followup next; approved last. Within those groups the oldest examination comes first. This is explicit workflow ordering, not a new medical assessment. Pages use offset pagination in batches of 100. Dashboard entry points link to this same queue.

The existing review form retains clinical notes/status and adds optional provider-written conclusion and follow-up recommendation. Review saves notify the patient. Existing clinician-assigned risk behavior is preserved.

## API

Success/error envelopes are unchanged. Private REST routes require `Authorization: Bearer <FootGuard JWT>`. CORS now permits PATCH.

| Method / route | Access / behavior |
| --- | --- |
| `GET /api/progress` | Patient's own timeline |
| `GET /api/provider/patients/:id/progress` | Existing provider review access |
| `GET /api/examinations/:id/comparison` | Patient ownership or existing provider access |
| `GET /api/provider/review-queue?offset=0` | Provider; 100 examinations per page |
| `GET /api/consultation/providers` | Patient; active provider IDs/names only |
| `GET, POST /api/conversations` | Patient/provider; create or list up to 100 conversations |
| `GET /api/conversations/:id` | Participants only |
| `GET /api/conversations/:id/messages?before=<message-id>` | Participants; newest 50, descending ID |
| `POST /api/conversations/:id/messages` | Participants; `{message}`; sender from JWT |
| `GET /api/conversations/:id/messages?since=<oldest-loaded-id>` | Participants; refresh up to 500 loaded messages, including edits/deletions; cannot combine with `before` |
| `PATCH /api/conversations/:id/messages/:message_id` | Message sender only; `{message}`; 1–3000 characters; persists `edited_at` |
| `DELETE /api/conversations/:id/messages/:message_id` | Message sender only; removes text, persists `deleted_at`, keeps history marker |
| `POST /api/conversations/:id/read` | Participants; `{through_id}`; marks only received/displayed messages |
| `GET /api/appointments` | Participant appointments, active first; limit 100 |
| `POST /api/appointments` | Patient; `{conversation_id,scheduled_at,notes}` |
| `PATCH /api/appointments/:id` | Participants; `{status}` with server-validated transitions |
| `POST /api/calls` | Participants; `{conversation_id,appointment_id?}` |
| `GET /api/calls/:id` | Participants only |
| `PATCH /api/calls/:id` | Participants; `{status}` |
| `GET /api/conversations/:id/calls` | Participants; latest 30 call logs |
| `GET /api/calls/ice-config` | Patient/provider; STUN and temporary TURN configuration; no-store |
| `POST /api/realtime/ticket` | Patient/provider; existing JWT middleware, one-use 30-second credential |
| `GET /api/realtime` | WebSocket upgrade; origin checked; ticket authenticated in first frame |
| `GET /api/notifications` | Own latest 50 notifications |
| `POST /api/notifications/:id/read` | Notification owner only |

For conversation creation, patients send `{provider_id,examination_id?}`; providers send `{patient_id,examination_id?}`. Identity fields for the calling role are rejected at the handler and derived again in the repository. Repeated creation of the same participant/context returns the existing conversation.

## Real-time transport

Browser → authenticated REST ticket → origin-checked WebSocket → `{ticket,cursor}` first frame → `ready` → private events. JWT/ticket values do not enter URLs or request logs. Only ticket hashes are stored. Tickets are atomically consumed, expire after 30 seconds, and cannot outlive JWT expiry. Sockets have a five-second authentication timeout, frame-size limits, read/write deadlines, ping keepalive, per-connection signal limits, JWT-expiry closure, and periodic stored account/role rechecks. REST message/call/ticket requests use Echo's small existing rate-limiter middleware; limiters are per process, not a distributed quota subsystem.

Message writes, notification creation, and delivery events commit together. Chat events contain message/conversation IDs rather than message contents. Events are addressed only to the two stored participants; each socket queries only its authenticated user's events every second. This database-backed event transport works across replicas without a process-local broadcast hub or extra broker. PostgreSQL advisory transaction locks serialize event ID allocation through commit so cursor delivery cannot skip an earlier uncommitted event.

React reconnects with bounded backoff and resumes its cursor during the same mounted session. REST remains authoritative; conversation/message/appointment views refresh periodically, including a five-second chat fallback while disconnected. Message history is paginated and kept bounded in the browser. No user HTML is rendered; React renders message strings as text.

Message actions require migration `006_message_actions.sql` after `005`, before starting the updated backend. Both participants can edit/delete only their own messages, enforced by the authenticated sender and conversation membership in PostgreSQL. Deleted messages cannot be edited or deleted again. Edits preserve creation/read timestamps and display “Diedit”; deletion clears the text and displays “Pesan dihapus” to both participants after confirmation. Conversation previews, unread counts, and stale message notifications update too. `message_updated` and `message_deleted` events contain IDs only and commit with the changes. Refresh includes loaded older messages (up to 500), so reconnect/polling recovers changes outside the newest page. Keep migration 006 in place for application rollback; its columns are additive and old clients can still read active messages.

Events persist for one day; SDP/ICE signals expire after two minutes. Expired rows are cleaned in bounded batches during ticket issuance. Expiry immediately excludes delivery; deletion follows cleanup. Use an operational cleanup job if the system has long periods without socket activity. Notifications remain in PostgreSQL with read timestamps; the current UI displays the latest 50, and the message badge counts unread messages from the latest 100 conversations. A global unread count across an arbitrarily large conversation archive is outside this bounded MVP.

Configure every reverse proxy for WebSocket HTTP upgrade and a timeout exceeding the 20-second ping interval. The repository nginx config has a dedicated `/api/realtime` location. JustRunMy's backend ingress must also support WSS. Keep production REST/WSS on TLS.

## Appointments

Patients request a future timestamp within one year, view appointments, and cancel requested/confirmed appointments. Providers confirm, cancel, or complete confirmed appointments after their scheduled start. Completed/cancelled appointments are terminal. Times use `TIMESTAMPTZ`, API timestamps with offsets/UTC, browser-local input conversion to UTC, and `Intl.DateTimeFormat` with the local zone label; WIB is not hardcoded.

Confirmed consultations occupy a 30-minute slot. Provider-row locking prevents concurrent overlapping confirmations for the same provider. Notes are limited to 3000 characters. Provider availability calendars and rescheduling are outside this MVP; cancel and submit a new request when another time is needed.

## Audio calls

The browsers use native `RTCPeerConnection`. Only `getUserMedia({audio:true,video:false})` is requested, when initiating or accepting a call. Audio travels over WebRTC, directly or through TURN, and is not proxied by Go. No recording or raw-audio storage is added. The implementation follows [MDN's WebRTC signaling flow](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling) using the same authenticated connection as chat, and the already installed [Go WebSocket transport](https://pkg.go.dev/golang.org/x/net/websocket).

Create a call through JWT-authenticated REST before sending `call_offer`. Only its caller may offer; only the callee may answer or reject. SDP/ICE delivery checks conversation membership, both stored participant accounts, call ID, direction, payload size, audio-only SDP, and active state. There are no client-trusted recipient IDs. `call_answer` and `ice_candidate` travel to the verified peer; `call_state` delivers acceptance/end/failure to both participants. Ending a call uses `PATCH /api/calls/:id` and emits the state event over the shared socket.

UI states: idle, calling, incoming, connecting, connected, ended, failed. Call controls include accept/reject, duration, mute/unmute, audio playback recovery, and end. Incoming dialogs trap keyboard focus and make the surrounding app inert. Browser peer failures and disconnected sockets close media tracks. Invitations timeout after 60 seconds; connecting UI times out after 45 seconds. Connected sessions send 20-second heartbeats. Backend expiry fails abandoned invitations after 60 seconds and connections without a heartbeat after 90 seconds, checked while sockets are active and before creating another call. Both users should be signed in with an active socket; this is not a background push or guaranteed provider-availability service.

Appointment-linked calls require a confirmed appointment in the same conversation, from 15 minutes before to one hour after its scheduled start. Participants may also make an unscheduled follow-up call from their conversation.

### STUN / TURN

**TURN server required for reliable production calls.** STUN/local calls can work without TURN but do not guarantee connectivity across every NAT/firewall. Production cross-network testing is still required.

Backend-only variables, also in `backend/.env.example` and Compose:

| Variable | Behavior |
| --- | --- |
| `PUBLIC_STUN_URL` | Defaults to `stun:stun.l.google.com:19302` |
| `TURN_URL` | Optional comma-separated `turn:` / `turns:` URLs |
| `TURN_SHARED_SECRET` | Optional private coturn REST shared secret; never returned to the frontend |

Configure coturn with `use-auth-secret`, `static-auth-secret` from your secret manager, and the chosen realm/network/TLS ports. When URL and shared secret are set, the backend issues HMAC-SHA1 coturn REST credentials with a 15-minute expiry. The authenticated endpoint exposes only temporary per-user credentials with `Cache-Control: no-store`. No frontend TURN secret or new `VITE_*` credential is required. Configure a TURN service separately; this change does not provision one. Test restrictive networks and long consultations against that service before release.

## Local run and verification

Use the existing backend and frontend setup instructions. Apply migrations 001–006 to a **local isolated test database**. Configure backend database/JWT/CORS/AI URL and frontend `VITE_API_URL` as before. Use real local accounts and provision a provider through `go run ./cmd/create-provider`. Start `go run ./cmd` and `npm run dev`. No AI rebuild is required.

```powershell
# backend directory
$env:FOOTGUARD_TEST_DATABASE_URL = '<isolated migrated PostgreSQL connection>'
go test ./...
go vet ./...
# frontend directory
npm.cmd run build
npm.cmd run lint
```

Windows systems with restricted PowerShell script execution can use `npm.cmd` instead of the `npm.ps1` shim. On a restricted Go cache, set `GOCACHE` to a writable temporary workspace directory.

The PostgreSQL integration suite creates unique test users and cleans only its own rows. Never set its database variable to Neon production. The existing Google/password integration test also runs using this variable; external Google credential verification remains covered by existing unit tests and needs a real OAuth browser check after deployment.

`scripts/consultation-browser-check.cjs` is an optional local browser harness requiring Playwright Core and Edge. It intentionally targets local API `8099`, frontend `5179`, and isolated PostgreSQL `55439` / `footguard_consultation_test`. Set `PLAYWRIGHT_MODULE` to an installed Playwright Core module path if it differs from this workstation. Start those local services with matching CORS, local database, and `VITE_API_URL`. It creates/deletes its own local fixture users, verifies bidirectional audio RTP using fake microphone devices, captures screenshots, and writes `artifacts/consultation-browser/results.json`. It does not prove real microphone hardware or cross-network TURN behavior.

## Production deployment order

1. Back up/check Neon and confirm migrations 001–004 are already applied. Preserve a restore point and inspect the proposed migration.
2. Apply 005 to Neon with `ON_ERROR_STOP=1`; verify the seven tables, new review columns, and indexes. This has not been performed by this implementation.
3. Build the backend Docker image from `backend/Dockerfile` using a **new unused tag**: the next version after the actual deployed version or a new commit-based tag. Do not overwrite the working tag.
4. Push that new image tag to the existing registry. Keep the previous image available.
5. Deploy the new image to the existing JustRunMy backend app. Preserve database/JWT/Google/AI/upload-volume settings; configure CORS, WSS ingress, STUN, and optional TURN secrets. Check health and participant authorization.
6. Confirm the previous backend image/tag can be selected for rollback. Do not delete it or its upload volume.
7. Push the reviewed frontend changes to the repository connected to Vercel. Preserve `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.
8. Let Vercel build/deploy the frontend and check client-side routes.
9. Test patient/provider password and Google login, upload/AI persistence/protected images/history, progress/comparison, older review queue records, both-direction chat/unread/notifications, appointment transitions/timezones, and two-device calls. Include real microphone permission deny/allow, mute, hang-up, audio autoplay, mobile layouts, disconnect/reconnect, and different networks with TURN.
10. Only after verification remove obsolete artifacts if desired. Do not redeploy/rebuild AI for this feature.

Example commands after choosing a reviewed new tag and registry:

```powershell
$taskImageTag = '<registry>/footguard-backend:<new-unused-version-or-commit-tag>'
docker build -t $taskImageTag ./backend
docker push $taskImageTag
```

## Rollback

Restore the previous Vercel frontend deployment and redeploy the previous JustRunMy backend image. Keep migration 005 and the new communication data in place: the prior backend does not use the new tables, and additive columns with defaults remain compatible. Do not run destructive DROP statements or restore an older database over newly stored communications for an ordinary application rollback. Use the checked backup/restore process only for an actual database incident. Restore previous environment settings if those were changed; keep uploads and the unchanged AI service available.

No production database migration, Docker push, JustRunMy deployment, Vercel push, or AI deployment was performed by this change.

For message actions, apply `006_message_actions.sql` after `005` before deploying the updated backend, then deploy the frontend. The focused `scripts/message-actions-browser-check.cjs` uses the same isolated local services/database as the consultation harness. It verifies sender-only controls, cancel/blank validation, retry after failed save, both-direction edits/deletes, persistence after reload, loaded older-message synchronization, and layouts at 360/390/768/1440px. Results/screenshots are written to `artifacts/message-actions-browser`.
