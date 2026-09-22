-- Calendar data (programs, courses) isn't stored here; it lives in data/ and loads at startup.

CREATE TABLE students (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution  text NOT NULL,
  campus       text NOT NULL,
  program_code text NOT NULL,
  entry_season text NOT NULL CHECK (entry_season IN ('Winter', 'Summer', 'Fall')),
  entry_year   integer NOT NULL CHECK (entry_year BETWEEN 1990 AND 2100),
  designations text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  course_code  text NOT NULL CHECK (course_code ~ '^[A-Z]{2,5} [0-9]{4}$'),
  term_season  text NOT NULL CHECK (term_season IN ('Winter', 'Summer', 'Fall')),
  term_year    integer NOT NULL CHECK (term_year BETWEEN 1990 AND 2100),
  result       text NOT NULL CHECK (result IN (
                 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F', 'WF',
                 'CR', 'NCR', 'W', 'INC', 'AEG', 'AUD', 'CTN', 'IP', 'TR')),
  notations    text[] NOT NULL DEFAULT '{}',
  -- only for courses missing from the current listings (retired, transfer)
  credit_hours numeric(3, 1) CHECK (credit_hours >= 0),
  title        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attempts_student_id_idx ON attempts (student_id);
