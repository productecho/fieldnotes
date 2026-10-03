# Fieldnotes feedback board

A full-stack feedback board with PostgreSQL persistence. Visitors can submit ideas, filter by category or status, and vote. Board status updates use an admin key.

## Deploy with ProductEcho

1. Fork the ProductEcho sample app repository on GitHub.
2. [Sign in to ProductEcho](https://app.productecho.com).
3. Create a PostgreSQL database in your ProductEcho workspace.
4. Open the database’s **Postgres** tab, copy its `DATABASE_URL`, then add it to your application’s environment variables with the name `DATABASE_URL`.
5. Create an application from your fork and paste your fork’s GitHub repository URL.
6. Set the app root directory to `feedback` in your fork.
7. Add `ADMIN_KEY` as a server-side environment variable. ProductEcho supplies `PORT`; the app listens on it.
8. Deploy with the included Dockerfile. Its container startup runs `npm run db:migrate` and `npm run db:seed` before starting the app, so the schema and sample ideas are ready automatically. Both commands are safe to run again on a later start; no separate ProductEcho start command is needed.
9. Open the deployed URL.

When ProductEcho’s GitHub flow opens a repository picker rather than a URL field, select your fork there. No Dockerfile edits are needed for the default deployment path.

<!-- Add a real ProductEcho deployment screenshot here. -->

The status editor asks for the `ADMIN_KEY` when you choose the `•••` menu on an idea. Keep that key private. This sample has no user authentication or vote rate limiting; add those before using it as a public production feedback system.
