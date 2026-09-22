// Runs migrations/*.sql in order, once each, one transaction per file.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "./db.ts";

const dir = join(import.meta.dirname, "migrations");

export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort();

  for (const file of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

if (import.meta.main) {
  try {
    await migrate();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
