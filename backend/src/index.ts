import { app } from "./app.ts";
import { snapshot } from "./catalog.ts";
import { pool } from "./db.ts";

const port = Number(process.env.PORT ?? 3000);

try {
  await pool.query("SELECT 1");
} catch (err) {
  console.error(`can't reach PostgreSQL at DATABASE_URL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`API on http://localhost:${port} (course calendar ${snapshot.calendarYear})`);
});

function shutdown() {
  server.close(() => void pool.end());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
