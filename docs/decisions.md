# Decisions

Short record of choices that shaped the project, newest last. Add one when you make a call someone might later question.

## 2026-09-21: The rules engine is the source of truth

Every answer about requirements comes from deterministic code over encoded calendar data. The AI advisor (planned) only explains results and explores options by calling the engine; it never states a requirement on its own. Anything that needs human judgment (instructor permission, "approved" electives, ambiguous wording) is reported as needing review.

## 2026-09-21: Stack

TypeScript, React, Node.js (Express), PostgreSQL, Claude API. Kept deliberately small. Supporting tools (npm workspaces, Vite, Vitest, Zod) are build and test infrastructure.

## 2026-09-21: Degree rules by entry year, prerequisites by current listings

Students follow the degree requirements of the calendar year they entered, but prerequisites are enforced at registration from the current calendar. The two are versioned separately: `data/programs/<campus>/<program>-<year>.json` and `data/courses/<campus>/<year>.json`.

## 2026-09-21: Calendar data lives in `data/` as JSON, not in code

Adding a calendar year is a data change. The same files can seed a database later and can be reviewed by someone who doesn't read TypeScript. Every rule carries the printed page and a quote from the calendar.

## 2026-09-21: The prerequisite parser doesn't guess

Prose it can't read confidently becomes `unparsed` and the course is marked `needs-review`. A short, explicit review queue is better than confident mistakes. New phrasings get a verbatim test. (Deferred to M2 in the rebuild; until then only the raw text is stored.)

## 2026-09-21: Our readings of the calendar are visible

Where the calendar is ambiguous we make a call and record it in the program's `interpretationNotes`. Inferred substitutions (CS 1543 for the retired CS 1103) are marked `confirmed: false`, and the audit shows them as needing review.

## 2026-09-21: Golden histories are worked out by hand

Expected results in `backend/test/golden` come from the calendar, not from running the engine. With no advisor reviewing yet, they are the main check on correctness.

## 2026-09-22: How the audit places courses

Named requirements (core, math) take their courses first, and pools never take a course a requirement names ("in addition to the courses listed above"). Pools are scored by the largest remaining gap, and specific requirements outrank free electives. Greedy fill plus local search, checked against exhaustive search on random records.

## 2026-09-22: pg with plain SQL, no ORM

Hand-written queries and numbered `.sql` migrations. Fewer dependencies, and the schema is easy to review. Constraints in the database back up validation in the API.

## 2026-09-22: No accounts in the first version

A profile id is kept in the browser so the audit could ship first. Accounts will add a `users` table and a nullable owner column on `students`.

## 2026-09-22: Proprietary license

All rights reserved, to keep options open for offering it to UNB later.

## 2026-09-22: Rebuild as a plain frontend/backend project

The first version grew packages, service layers and features ahead of the degree audit. The rebuild keeps the data, engine, allocator and golden tests, and drops the rest: two npm workspaces (`frontend`, `backend`), routes that call SQL query functions directly, and no co-op, approvals or eligibility until a milestone needs them. `architecture.md` describes the result.

## 2026-09-22: Advisor plan (M4, to be designed properly then)

Students will want to talk things through: "I'm into web dev or ML, what should I take?", "is ANTH 1001 worth it?", "would geomatics or a TME diploma help me?". The advisor splits that into three jobs:

- **Retrieval finds candidates.** Semantic search over course descriptions (and, later, minor and diploma pages), because students' words rarely match course titles. Vectors go in the existing Postgres with `pgvector`, combined with keyword search for codes and exact terms.
- **The engine decides what a course does for the student.** Whether and where it counts, restrictions and exclusions, and prerequisites after M2. Minors and diplomas that students ask about get encoded as program data like BCS, not answered from retrieved text.
- **An LLM runs the conversation.** It calls search and the engine as tools and explains the result. It never states a requirement the engine didn't return, and it says so when we have no data (course difficulty, for example) instead of guessing.

Guardrails are part of the design, not an add-on: the advisor only answers questions about courses, programs and planning, and declines everything else (coding help, homework, general chat). It has per-student rate limits and a daily usage cap. How to enforce the topic limit, which model to use and how to evaluate answers are decided at M4.


## 2026-09-22: Keep each student's latest transcript PDF

The import used to keep the PDF in the browser. We now store the latest upload per student (a new one replaces it) so later features can use more of the transcript than the course lines. It holds personal data, so: the privacy section (to be written) will say we keep it, nothing serves it back until there are accounts to protect it, and it's deleted with the profile.
