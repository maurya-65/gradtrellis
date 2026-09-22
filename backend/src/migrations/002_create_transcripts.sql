-- The latest transcript PDF each student imported. A new upload replaces it.
-- It holds personal data (name, student number, birth date), so nothing serves it back yet.

CREATE TABLE transcripts (
  student_id  uuid PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
  file        bytea NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
