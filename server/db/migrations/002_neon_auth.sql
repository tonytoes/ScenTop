-- Keep numeric customer IDs and all existing order/cart relationships.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- A retained identity with NULL user_id is a deletion tombstone: an old
-- Neon session must not silently recreate a deleted ScenTop account.
CREATE TABLE user_auth_identities (
  issuer text NOT NULL,
  subject text NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
);
CREATE INDEX user_auth_identities_user_idx ON user_auth_identities(user_id);
