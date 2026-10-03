import { pool } from "./pool.js";

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ideas (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL CHECK (char_length(title) BETWEEN 6 AND 100),
      description TEXT NOT NULL CHECK (char_length(description) BETWEEN 12 AND 600),
      category TEXT NOT NULL CHECK (category IN ('Workflow', 'Integrations', 'Reporting', 'Other')),
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('under_review', 'planned', 'in_progress', 'shipped')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS votes (
      idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      voter_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (idea_id, voter_id)
    );
    CREATE INDEX IF NOT EXISTS ideas_created_at_idx ON ideas (created_at DESC);
  `);
  console.log("Database schema is ready.");
} finally {
  await pool.end();
}
