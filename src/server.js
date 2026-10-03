import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { pool } from "./db/pool.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const statuses = new Set(["under_review", "planned", "in_progress", "shipped"]);
const categories = new Set(["Workflow", "Integrations", "Reporting", "Other"]);
const voterCookie = "feedback_voter";

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  const existingCookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${voterCookie}=`));
  const existing = existingCookie?.slice(voterCookie.length + 1) || req.headers["x-voter-id"];
  const voterId = typeof existing === "string" && /^[a-f0-9-]{36}$/i.test(existing)
    ? existing
    : crypto.randomUUID();
  res.locals.voterId = voterId;
  res.setHeader("Set-Cookie", `${voterCookie}=${voterId}; Path=/; Max-Age=31536000; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  next();
});
app.use(express.static(path.join(here, "../public"), { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready", database: "connected" });
  } catch {
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

app.get("/api/ideas", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const category = typeof req.query.category === "string" ? req.query.category : "all";
    if (status !== "all" && !statuses.has(status)) return res.status(400).json({ error: "Choose a valid status filter." });
    if (category !== "all" && !categories.has(category)) return res.status(400).json({ error: "Choose a valid category filter." });
    const { rows } = await pool.query(
      `SELECT i.id, i.title, i.description, i.category, i.status,
              i.created_at, i.updated_at, COUNT(v.idea_id)::int AS votes,
              BOOL_OR(v.voter_id = $3) AS voted
       FROM ideas i LEFT JOIN votes v ON v.idea_id = i.id
       WHERE ($1 = 'all' OR i.status = $1) AND ($2 = 'all' OR i.category = $2)
       GROUP BY i.id
       ORDER BY votes DESC, i.created_at DESC`,
      [status, category, res.locals.voterId],
    );
    res.json({ ideas: rows });
  } catch (error) { next(error); }
});

app.post("/api/ideas", async (req, res, next) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const category = typeof req.body.category === "string" ? req.body.category : "";
    if (title.length < 6 || title.length > 100) return res.status(400).json({ error: "Title must be 6–100 characters." });
    if (description.length < 12 || description.length > 600) return res.status(400).json({ error: "Description must be 12–600 characters." });
    if (!categories.has(category)) return res.status(400).json({ error: "Choose a valid category." });
    const { rows } = await pool.query(
      "INSERT INTO ideas (title, description, category) VALUES ($1, $2, $3) RETURNING id, title, description, category, status, created_at, updated_at",
      [title, description, category],
    );
    res.status(201).json({ idea: { ...rows[0], votes: 0, voted: false } });
  } catch (error) { next(error); }
});

app.post("/api/ideas/:id/vote", async (req, res, next) => {
  const client = await pool.connect().catch(next);
  if (!client) return;
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM ideas WHERE id = $1", [req.params.id]);
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "That idea no longer exists." });
    }
    const existing = await client.query("DELETE FROM votes WHERE idea_id = $1 AND voter_id = $2 RETURNING idea_id", [req.params.id, res.locals.voterId]);
    if (!existing.rowCount) await client.query("INSERT INTO votes (idea_id, voter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [req.params.id, res.locals.voterId]);
    const { rows } = await client.query("SELECT COUNT(*)::int AS votes FROM votes WHERE idea_id = $1", [req.params.id]);
    await client.query("COMMIT");
    res.json({ votes: rows[0].votes, voted: !existing.rowCount });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.patch("/api/ideas/:id/status", async (req, res, next) => {
  if (!process.env.ADMIN_KEY || req.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Status changes require the board admin key." });
  }
  const status = typeof req.body.status === "string" ? req.body.status : "";
  if (!statuses.has(status)) return res.status(400).json({ error: "Choose a valid status." });
  try {
    const { rows } = await pool.query("UPDATE ideas SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at", [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "That idea no longer exists." });
    res.json({ idea: rows[0] });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = app.listen(port, "0.0.0.0", () => console.log(`Feedback Board listening on port ${port}`));
async function shutdown(signal) {
  console.log(`${signal} received; closing server and database pool.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
