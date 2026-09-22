import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see backend/.env.example)");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => console.error("postgres pool error:", err.message));
