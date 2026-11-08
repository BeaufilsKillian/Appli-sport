CREATE TABLE IF NOT EXISTS training_nutrition_heads (
 owner_id text PRIMARY KEY,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE IF NOT EXISTS training_nutrition (
 owner_id text NOT NULL,
 key text NOT NULL CHECK (length(key) <= 110),
 payload jsonb,
 revision bigint NOT NULL CHECK (revision > 0),
 PRIMARY KEY (owner_id,key),
 CHECK (payload IS NULL OR octet_length(payload::text) <= 70000)
);
CREATE INDEX IF NOT EXISTS training_nutrition_changes ON training_nutrition(owner_id,revision);
ALTER TABLE training_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_nutrition_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_nutrition,training_nutrition_heads FROM PUBLIC;
