BEGIN;

ALTER TABLE medical_reviews
    ADD COLUMN conclusion TEXT NOT NULL DEFAULT '',
    ADD COLUMN followup_recommendation TEXT NOT NULL DEFAULT '';

-- Patient IDs are patients.id; provider/sender IDs are users.id.
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    provider_id BIGINT NOT NULL REFERENCES users(id),
    examination_id BIGINT REFERENCES examinations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversations_context_unique_idx ON conversations
    (patient_id, provider_id, COALESCE(examination_id, 0));
CREATE INDEX conversations_patient_activity_idx ON conversations(patient_id, updated_at DESC);
CREATE INDEX conversations_provider_activity_idx ON conversations(provider_id, updated_at DESC);

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    sender_id BIGINT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 3000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);
CREATE INDEX messages_history_idx ON messages(conversation_id, id DESC);
CREATE INDEX messages_unread_idx ON messages(conversation_id, sender_id) WHERE read_at IS NULL;

CREATE TABLE appointments (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','confirmed','completed','cancelled')),
    notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 3000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appointments_schedule_idx ON appointments(conversation_id, scheduled_at);

CREATE TABLE call_sessions (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    appointment_id BIGINT REFERENCES appointments(id),
    caller_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'calling'
        CHECK (status IN ('calling','connecting','connected','ended','failed','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calls_one_active_idx ON call_sessions(conversation_id)
    WHERE status IN ('calling','connecting','connected');
CREATE INDEX calls_history_idx ON call_sessions(conversation_id, id DESC);

-- One-use socket credentials: store only SHA-256 digests, never JWTs.
CREATE TABLE realtime_tickets (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    session_expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX realtime_tickets_expiry_idx ON realtime_tickets(expires_at);

-- Database-backed delivery works across backend replicas. Signaling expires quickly.
CREATE TABLE realtime_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day'
);
CREATE INDEX realtime_events_user_cursor_idx ON realtime_events(user_id, id);
CREATE INDEX realtime_events_expiry_idx ON realtime_events(expires_at);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    conversation_id BIGINT REFERENCES conversations(id),
    examination_id BIGINT REFERENCES examinations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_history_idx ON notifications(user_id, id DESC);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id) WHERE read_at IS NULL;

COMMIT;
