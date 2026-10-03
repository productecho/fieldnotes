import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL before starting the app.",
  );
}

try {
  const databaseUrl = new URL(connectionString);
  if (!databaseUrl.password) {
    throw new Error("DATABASE_URL has no password.");
  }
} catch (error) {
  throw new Error(
    `DATABASE_URL is invalid: ${error instanceof Error ? error.message : "expected a PostgreSQL connection URL"}`,
  );
}

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 5),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined,
});

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error", error);
});
