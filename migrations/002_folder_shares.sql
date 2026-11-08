CREATE TABLE IF NOT EXISTS training_folder_shares (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked boolean NOT NULL DEFAULT false,
  claimed_by text,
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS training_folder_shares_owner ON training_folder_shares(owner_id, created_at DESC);
ALTER TABLE training_folder_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_folder_shares FROM PUBLIC;
