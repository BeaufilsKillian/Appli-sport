BEGIN;
CREATE TABLE IF NOT EXISTS training_heads (
  owner_id text PRIMARY KEY,
  revision integer NOT NULL CHECK (revision >= 1)
);
CREATE TABLE IF NOT EXISTS training_backups (
  owner_id text NOT NULL REFERENCES training_heads(owner_id) ON DELETE CASCADE,
  revision integer NOT NULL,
  payload jsonb NOT NULL CHECK (payload->>'format' = 'training-programme-backup'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, revision)
);
-- Les sauvegardes sont accessibles exclusivement par les fonctions serveur Vercel.
-- Aucun accès anonyme/Data API n'est accordé à ces tables.
ALTER TABLE training_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_heads, training_backups FROM PUBLIC;
COMMIT;
