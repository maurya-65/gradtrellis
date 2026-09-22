# GradTrellis

Degree audit for UNB Fredericton Bachelor of Computer Science students. Enter the term you started and your courses, and it shows which requirements are met, what's in progress and what's left, with a citation to the calendar for each rule.

It's an independent student project, not affiliated with UNB. The Undergraduate Calendar and your Faculty advisor are the authority on degree requirements.

## Setup

Needs Node 24 and PostgreSQL.

```sh
npm install
cp backend/.env.example backend/.env   # then set DATABASE_URL
createdb gradtrellis
npm run db:migrate
```

## Running

```sh
npm run dev:backend    # API on http://localhost:3000
npm run dev:frontend   # app on http://localhost:5173, proxies /api to the backend
```

## Tests

```sh
npm test
npm run typecheck
```

The API tests run only when `TEST_DATABASE_URL` is set in `backend/.env`. They drop and recreate the tables in that database, so give them their own. `DEEP_TESTS=1 npm test` runs the full allocator check against brute force.

## Calendar data

Degree rules are hand-encoded in `backend/data/programs`. Course listings come from the UNB calendar:

```sh
npm run scrape                          # uses cached pages
npm run scrape -- --refresh             # downloads again
npm run scrape -- --only mathematics    # some subjects only
```

See [docs/architecture.md](docs/architecture.md) for how it fits together, [docs/calendar-notes.md](docs/calendar-notes.md) for calendar quirks and [docs/decisions.md](docs/decisions.md) for why things are the way they are.
