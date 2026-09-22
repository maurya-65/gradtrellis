-- "Forgot password" links. One per user: asking again replaces the old link.
-- Only a hash of the emailed token is kept.
CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
