-- Accounts: a UNB email, a student number and a password. A signup only becomes a
-- user once the email is confirmed. Each user has at most one degree profile.

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%@unb.ca'),
  -- as typed at signup; it only counts once a transcript with the same number verifies it
  student_number text NOT NULL,
  password_hash  text NOT NULL,
  -- from the verified transcript, as printed ("Lastname, Firstnames")
  name           text,
  verified_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- A typed number can't lock anyone out; only one account can verify each number.
CREATE UNIQUE INDEX users_verified_student_number_idx ON users (student_number) WHERE verified_at IS NOT NULL;

-- Waiting for the email to be confirmed. Only a hash of the emailed token is kept.
CREATE TABLE signups (
  token_hash     text PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  student_number text NOT NULL,
  password_hash  text NOT NULL,
  expires_at     timestamptz NOT NULL
);

-- The cookie holds a random token; only its hash is stored.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Profiles made before accounts existed have no owner and can't be claimed.
DELETE FROM students;

ALTER TABLE students ADD COLUMN user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE;
