import { pool } from "./pool.js";

const examples = [
  ["Let me save a deployment as a reusable template", "I deploy the same API and database setup for several small projects. A template for the runtime, health check, and environment names would save setup time.", "Workflow", "under_review"],
  ["Show which commit is running", "Put the source branch and short commit SHA beside the live deployment so I can confirm a preview is using the change I expect.", "Integrations", "planned"],
  ["Add a weekly activity summary", "A compact email with deployments, failed builds, and database changes would help me keep up with a small team without checking every project.", "Reporting", "in_progress"],
  ["Make it easier to compare two releases", "I want to see the environment changes between the current deployment and the previous one before I roll back.", "Workflow", "shipped"],
  ["Support a shorter project URL", "A memorable URL is easier to share during a customer call than a generated project name.", "Other", "under_review"],
];

try {
  for (const [title, description, category, status] of examples) {
    await pool.query(
      `INSERT INTO ideas (title, description, category, status)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM ideas WHERE title = $1)`,
      [title, description, category, status],
    );
  }
  console.log("Sample feedback is ready.");
} finally {
  await pool.end();
}
