# Architecture

GradTrellis is a degree audit for UNB Fredericton Bachelor of Computer Science (BCS) students. A student enters the term they started and their courses, and the audit shows which requirements are met, what is in progress and what is left.

## Principles

- The rules engine is the only source of truth. Degree rules live in `backend/data` as JSON, never in code.
- Every rule cites the calendar (document, printed page, quote), and the audit passes the citation through to the UI.
- Anything that needs human judgment ("approved elective", "with prior approval", an unconfirmed course substitution, an ambiguous tier) gets the status `review`. The engine never decides it.

## Layout

```
frontend/   React + Vite + Tailwind + React Router
backend/
  src/
    index.ts          starts the server
    app.ts            Express app and error handler
    db.ts, migrate.ts pg pool and the migration runner
    migrations/       numbered .sql files
    routes/           one file per resource; handlers call query functions directly
    queries/          SQL for student data
    catalog.ts        loads data/ at startup, course search
    engine/           schemas and the degree audit (no Express, pg or fs imports)
  data/               calendar data: programs, course listings, grading scale
  scripts/scrape/     downloads UNB course listings into data/courses
  test/               engine, golden and API tests
docs/
```

The frontend imports engine *types* (and the small term helpers in `engine/terms.ts`) from the backend workspace, so response types can't drift. It never runs the engine.

npm workspaces, not pnpm. Node 24 runs the TypeScript directly (type stripping), so the backend has no build step.

## Data

| Path | Contents | Produced by |
|---|---|---|
| `data/programs/unb-fredericton/bcs-2024-2025.json` | Requirements, designations (Honours, Cybersecurity), policies, interpretation notes | Hand-encoded from the 2024-2025 calendar |
| `data/courses/unb-fredericton/<year>.json` | Every Fredericton course listing: credit hours, flags, credit restrictions and exclusions, raw prerequisite text | `npm run scrape` |
| `data/grading/unb.json` | Letter grade points and which results count for credit, GPA and attempts | Hand-encoded from Section B |

Degree requirements follow the calendar the student **entered** under. Course facts come from the **current** listings. The two are versioned separately (see `calendar-notes.md`).

Prerequisites are stored as raw text only. Parsing them and checking eligibility are M2 work.

## Degree audit

`engine/audit` answers which requirement each course fills and what is left.

1. **Usable courses.** Each course counts once, from its best attempt. A course with no grade yet is in progress, or planned if its term is after the current one; the server passes the current term in, so the engine never reads the clock. Grades below the program minimum, withdrawals, non-credit courses, credit restrictions and credit exclusions ("credit for only one of") are set aside with a reason.
2. **Allocation.** Named-course requirements (core, math) take their course first, and pools never take a course a requirement names. Pools (technical electives, breadth, free electives) then compete for the rest. A placement is scored by outstanding work, with specific requirements ahead of free electives. The score counts in-progress courses as passed first, then only completed courses. A greedy fill is refined by moves and swaps, and every combination of alternatives (Math Option A or B, ...) is tried. `test/engine/allocate.test.ts` checks the result against exhaustive search on random records.
3. **Evaluation.** Each requirement reports its status (complete, in progress, planned, needs review or incomplete), the courses used, what remains in plain language and its calendar source. Overlays (the writing requirement) and designations are checked against all usable courses without consuming them. Honours tightens the technical elective rules through patches in the program data.

Policy warnings: the BCS three-fail rule, the three-attempt limit and the reduced load below a 2.0 CGPA.

## API

All routes are under `/api`. Errors look like `{ "error": { "message", "details"? } }`.

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness and the loaded course calendar year |
| `GET /courses?q=&limit=` | Course search by code prefix or title words |
| `POST /auth/signup` | Start a signup (full name, UNB email, student number, password); always answers 202 and the email says what happened |
| `POST /auth/confirm` | Create the account from the emailed token and log in |
| `POST /auth/login`, `POST /auth/logout` | Start or end a session |
| `GET /auth/me` | The logged-in user and their profile (or null) |
| `PATCH /auth/me` | Change the account's name; once verified it has to match the transcript |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | Email a reset link; set a new password from it (logs out every session) |
| `PUT /auth/password` | Change the password with the current one (logs out other sessions) |
| `POST /student` | Create the user's profile (entry term, designations) |
| `GET /student`, `PATCH /student` | Read the profile or change its designations |
| `POST /student/attempts` | Add a transcript line |
| `PUT /student/attempts` | Replace every transcript line in one transaction (transcript import) |
| `PUT /student/transcript` | Store the latest transcript PDF (raw `application/pdf` body, 5 MB max) and verify the account |
| `PATCH /student/attempts/:attemptId` | Change a transcript line's result (e.g. in progress to a grade) |
| `DELETE /student/attempts/:attemptId` | Remove a transcript line |
| `GET /student/audit` | Degree audit |
| `GET /student/eligibility?courses=&term=` | Whether the student meets each course's prerequisites and corequisites for a term (default: the next one) |
| `GET /student/suggestions?term=` | Required courses the audit still counts as missing whose prerequisites are met, pending or need review for the term (electives from pools aren't suggested) |

## Prerequisites

`src/engine/requisites.ts` parses a course's prerequisite and corequisite text into a tree: courses (with a grade minimum from "(at least B)" or "a grade of B or higher in X"), cross-listed codes ("MATH 3463/PHYS 3912"), credit-hour minimums (optionally in named subjects: "12 ch in Mathematics and/or Statistics"), program enrolment, and `all`/`any` groups.

- Commas take the list's conjunction ("A, B and C"). `;` separates higher-level groups, and so do commas in a list ending ", and"/", or" (the calendar's "A or B, C or D, and E").
- Trailing notes ("NOTE: Credit ...") and "(X recommended)" asides are dropped.
- Instructor or department permission and "or equivalent" stay as review items, so "X or permission of the instructor" is still met by X.
- Anything else stays text: high school courses, prose, and lists that are ambiguous without brackets (mixing `and` with `or`, or "A or B, C or D" with no closing ", and").

Checking a tree for a term gives `met` (passed before the term), `pending` (only through courses in progress or planned before it), `missing`, or `review` (text decides, or a CR/TR can't show the grade). Corequisites are checked the same way, except that a course taken in the same term counts. A course's status is the worse of the two. 59% of the catalog's prerequisites parse fully (74% of CS, MATH and STAT), and 78% of corequisites.

## Accounts

A signup (full name, `@unb.ca` email, 7-digit student number, password) waits in `signups` until the student opens the emailed link and presses Confirm; only then is the user created. Confirming on a button press, not on opening the link, keeps UNB's Microsoft 365 link scanner from using up the token. Emails are unique, and the signup response never says whether one is taken.

The student number typed at signup proves nothing on its own, so it doesn't block anyone. It is verified when the student uploads their transcript: the server reads the PDF itself (`src/transcript/read.ts`) and the number printed on it must match the account's. The name printed on it must also match the UNB email, which for students is `givennames.surname@unb.ca` (emails in other shapes can't be judged and pass). That sets `verified_at` and stores the transcript's name. Only one account can verify a given number, so someone typing another student's number can't lock them out, and verifying deletes any other unverified accounts that typed the same number (they get an email saying so).

The name typed at signup is checked against the transcript's when the account is verified (`src/names.ts`: accents, punctuation and word order don't matter, and a small typo is forgiven via edit distance). If it doesn't match, the student has 7 days (`name_deadline`) to change it in their profile; after that the account is suspended: it can still log in and fix the name, but `/student` answers 403. Once verified, a name can only be changed to one that matches the transcript. An edited PDF could still get through; "Sign in with UNB" through UNB's Microsoft 365 is the airtight version, and a student ID card scan is an idea for later.

Passwords are hashed with scrypt. A login creates a random session token in an `httpOnly`, `SameSite=Lax` cookie that lasts 30 days; the `sessions` table stores only its SHA-256 hash, so logging out deletes it for good. Everything under `/student` belongs to the logged-in user, so there are no ids to guess. Ten wrong passwords lock an email out for 15 minutes (in memory, one server).

There is no mail provider yet: `src/email.ts` prints emails to the console.

## Database

PostgreSQL through `pg` with hand-written SQL. Tables: `users`, `signups`, `sessions` and `password_resets` for accounts; `students` (one per user), `attempts` and `transcripts` (the latest uploaded PDF). CHECK constraints back up the request validation. Calendar data is not stored in the database.

## Frontend

Signup, confirm and login pages, then setup (entry term, Honours, Cybersecurity), transcript (course search, add and remove attempts, grouped by term) and audit. The session lives in the cookie, so `useSession` asks `/auth/me` who is logged in on every load.

The transcript page can import the unofficial transcript PDF from myUNB. pdf.js reads it in the browser (`src/transcript/pdf.ts`), and the parser shared with the server (`backend/src/transcript/parse.ts`) picks out the student number, term headings and course lines, and the student reviews the result before it replaces their attempts. Saving also stores the PDF in `transcripts`, one per student, replacing any earlier upload. It holds personal data (name, student number, birth date), so no endpoint serves it back. The profile icon in the header opens a menu with the profile page and logging out. The profile page shows whether the account is verified and changes the name, the Honours and Cybersecurity choices, the password and the appearance (light, dark or system, kept per device in `localStorage`). A banner on every page warns about a name that doesn't match the transcript.

## Tests

- `test/engine`: GPA and grade rules, audit rules, and the allocator against brute force (`DEEP_TESTS=1` for the full set).
- `test/golden`: hand-worked student histories. The expected values come from the calendar, not from running the engine.
- `test/data.test.ts`: the program file only names courses that exist or are accounted for.
- `test/api.test.ts`: HTTP routes against a real PostgreSQL database (`TEST_DATABASE_URL`).
- `test/transcript.test.ts`: the transcript parser, on a synthetic transcript in the myUNB layout. `test/transcript-pdf.ts` builds synthetic transcript PDFs for the API tests.

## Milestones

| | Scope |
|---|---|
| M1 | Degree audit (this rebuild) |
| M2 | Prerequisite parsing, eligibility, next-term suggestions |
| M3 | Path to graduation: co-op, summer terms, what-if scenarios |
| M4 | Advisor: course discovery by interest and audit explanations, using retrieval and the engine as tools, limited to degree planning (see `decisions.md`) |
