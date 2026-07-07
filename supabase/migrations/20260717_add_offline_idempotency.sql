-- Idempotency columns for offline write support (vNext 14).
-- These nullable columns let the client assign a unique operation ID so the
-- API layer can detect duplicate inserts when retrying after a failed sync.
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS client_operation_id text;

ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS client_operation_id text;

ALTER TABLE readiness_logs ADD COLUMN IF NOT EXISTS client_operation_id text;
