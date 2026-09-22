-- Students give their full name at signup. Verifying with a transcript checks it against the
-- name printed there; a name that doesn't match has to be fixed by a deadline.

ALTER TABLE users RENAME COLUMN name TO transcript_name;

ALTER TABLE users ADD COLUMN name text;
-- accounts from before names were asked for: the transcript's name if verified, else the email
UPDATE users SET name = coalesce(trim(split_part(transcript_name, ',', 2)) || ' ' || trim(split_part(transcript_name, ',', 1)), split_part(email, '@', 1));
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- set when the signup name doesn't match the transcript; once it passes, the account is suspended
ALTER TABLE users ADD COLUMN name_deadline timestamptz;

-- signups waiting for confirmation have no name, so they have to sign up again
DELETE FROM signups;
ALTER TABLE signups ADD COLUMN name text NOT NULL;
