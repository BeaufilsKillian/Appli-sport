BEGIN;
CREATE TABLE IF NOT EXISTS training_access (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','blocked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS training_access_pending ON training_access (requested_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS training_admin_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  auth_session text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS training_admin_attempts (
  user_id text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS training_admin_push (
  endpoint_hash text PRIMARY KEY,
  user_id text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE training_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_admin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_admin_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_access, training_admin_sessions, training_admin_attempts, training_admin_push FROM PUBLIC;
COMMIT;
