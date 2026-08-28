# Hiveborn Agent Guide

## Git Workflow

- Commit changes continuously as you work, grouping related edits into meaningful commits rather than leaving work uncommitted until the end.
- If you are working in a worktree, rebase your completed work onto `main` before handing it off.
- If you are already on `main`, keep changes and commits directly on `main`; do not create a separate integration branch.

## Local Play Mode Login

When Hiveborn is running locally, use the **/Local test sign-in/** link in the top navigation to enter Play Mode without WorkOS setup. It only appears for `localhost` and `127.0.0.1`, and the backend rejects the endpoint in production or for non-local hosts.

The button creates or reuses the development-only `LocalHivekeeper` account (`local-hivekeeper`). Its sealed-session substitute is accepted only while `NODE_ENV` is not `production`; it must never be enabled for a deployed environment. It is useful for exercising cloud character sync, group creation, invitations, GM fallout rolls, roll sharing, and WebSocket updates in a local app.

## Play Mode Architecture

- Authentication is WorkOS AuthKit, using the same WorkOS application credentials as Progeny and Cozy Crowns. Existing accounts therefore authenticate here too.
- The backend is Fastify with Drizzle/SQLite. Backend resource metrics are tracked in PostHog every ten minutes.
- Character updates are persisted to `/characters`, broadcast through the group WebSocket, and then reloaded by connected group views.
- Group members can read each other’s sheets; only the authenticated character owner can edit a sheet directly. GM fallout auto-updates are carried out through the group fallout endpoint when explicitly selected.

## Local Development

- `mprocs.yaml` is the oprocs-compatible one-command launcher. It starts the backend, frontend, and optional Drizzle Studio together.
- In this shared workspace it inherits the existing Progeny backend WorkOS configuration for local development without copying any secrets into this repository.
- Run `pnpm install` at the root and `pnpm --dir backend install` before the first launch.
