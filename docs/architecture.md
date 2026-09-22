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

1. **Usable courses.** Each course counts once, from its best attempt. Grades below the program minimum, withdrawals, non-credit courses, credit restrictions and credit exclusions ("credit for only one of") are set aside with a reason.
2. **Allocation.** Named-course requirements (core, math) take their course first, and pools never take a course a requirement names. Pools (technical electives, breadth, free electives) then compete for the rest. A placement is scored by outstanding work, with specific requirements ahead of free electives. The score counts in-progress courses as passed first, then only completed courses. A greedy fill is refined by moves and swaps, and every combination of alternatives (Math Option A or B, ...) is tried. `test/engine/allocate.test.ts` checks the result against exhaustive search on random records.
3. **Evaluation.** Each requirement reports its status, the courses used, what remains in plain language and its calendar source. Overlays (the writing requirement) and designations are checked against all usable courses without consuming them. Honours tightens the technical elective rules through patches in the program data.

Policy warnings: the BCS three-fail rule, the three-attempt limit and the reduced load below a 2.0 CGPA.

## API

All routes are under `/api`. Errors look like `{ "error": { "message", "details"? } }`.

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness and the loaded course calendar year |
| `GET /courses?q=&limit=` | Course search by code prefix or title words |
| `POST /students` | Create a profile (entry term, designations) |
| `GET /students/:id`, `PATCH /students/:id` | Read a profile or change its designations |
| `POST /students/:id/attempts` | Add a transcript line |
| `PUT /students/:id/attempts` | Replace every transcript line in one transaction (transcript import) |
| `DELETE /students/:id/attempts/:attemptId` | Remove a transcript line |
| `GET /students/:id/audit` | Degree audit |

There are no accounts yet. The frontend keeps the profile id in localStorage.

## Database

PostgreSQL through `pg` with hand-written SQL. There are two tables, `students` and `attempts`, and CHECK constraints back up the request validation. Calendar data is not stored in the database.

## Frontend

Three pages: setup (entry term, Honours, Cybersecurity), transcript (course search, add and remove attempts, grouped by term) and audit.

The transcript page can import the unofficial transcript PDF from myUNB. pdf.js reads it in the browser (`src/transcript/pdf.ts`), `src/transcript/parse.ts` picks out term headings and course lines, and the student reviews the result before it replaces their attempts. The PDF itself (name, student number, birth date) never reaches the server. A small profile control in the header changes the Honours and Cybersecurity choices after setup.

## Tests

- `test/engine`: GPA and grade rules, audit rules, and the allocator against brute force (`DEEP_TESTS=1` for the full set).
- `test/golden`: hand-worked student histories. The expected values come from the calendar, not from running the engine.
- `test/data.test.ts`: the program file only names courses that exist or are accounted for.
- `test/api.test.ts`: HTTP routes against a real PostgreSQL database (`TEST_DATABASE_URL`).
- `frontend/src/transcript/parse.test.ts`: the transcript parser, on a synthetic transcript in the myUNB layout.

## Milestones

| | Scope |
|---|---|
| M1 | Degree audit (this rebuild) |
| M2 | Prerequisite parsing, eligibility, next-term suggestions |
| M3 | Path to graduation: co-op, summer terms, what-if scenarios |
| M4 | Advisor: course discovery by interest and audit explanations, using retrieval and the engine as tools, limited to degree planning (see `decisions.md`) |
