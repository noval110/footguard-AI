BEGIN;

ALTER TABLE messages
    ADD COLUMN edited_at TIMESTAMPTZ,
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- Keep a tombstone in history, while removing the deleted message text.
ALTER TABLE messages DROP CONSTRAINT messages_message_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_check CHECK (
    (deleted_at IS NULL AND char_length(btrim(message)) BETWEEN 1 AND 3000)
    OR (deleted_at IS NOT NULL AND message = '')
);

COMMIT;
