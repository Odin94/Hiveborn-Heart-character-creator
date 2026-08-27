# Backend

TypeScript/Fastify backend for Hiveborn. It runs behind Caddy in production and uses SQLite for persistence.

## Local development

```bash
pnpm install
cp .env.sample .env
pnpm run db:migrate
pnpm run dev
```

## Production deployment (Hetzner + Caddy)

Hiveborn follows the same model as Progeny: a dedicated `hiveborn` user runs Fastify under PM2, and Caddy terminates TLS before proxying to the loopback-only backend on port `3003`.

The first deployment is handled by [`scripts/setupServer.sh`](scripts/setupServer.sh). It installs the required system packages, creates the `hiveborn` user and `/opt/hiveborn` checkout, prompts for the production environment secrets when `.env` does not already exist, builds and migrates the backend, configures the PM2 startup service, and safely replaces only the `api-hiveborn` Caddy site block (with a backup of the prior Caddyfile).

```bash
scp backend/scripts/setupServer.sh root@YOUR_HETZNER_IP:/tmp/hiveborn-setup.sh
ssh root@YOUR_HETZNER_IP 'chmod +x /tmp/hiveborn-setup.sh && /tmp/hiveborn-setup.sh'
```

The script needs the API DNS record to have propagated before it reloads Caddy and requests TLS. Create these records first:

- `api-hiveborn.odin-matthias.de`: an `A` record for the Hetzner server's IPv4 address, plus an `AAAA` record only when that IPv6 address is publicly reachable.
- `hiveborn.odin-matthias.de`: keep this pointing at the frontend host (for example Netlify); it should not point at Hetzner unless the frontend is moved there too.

Allow inbound TCP ports `80` and `443` in the Hetzner Cloud firewall (and in any host firewall). Do not expose port `3003`.

If the script is run non-interactively, create `/opt/hiveborn/backend/.env`, owned by `hiveborn` and mode `0600`, with these production values before running it:

```dotenv
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_COOKIE_PASSWORD=... # at least 32 characters
PUBLIC_POSTHOG_KEY=...
PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NODE_ENV=production
PORT=3003
HOST=localhost
FRONTEND_URL=https://hiveborn.odin-matthias.de
BACKEND_URL=https://api-hiveborn.odin-matthias.de
DATABASE_URL=./data/hiveborn.sqlite
```

## Frontend, WorkOS, and DNS

The browser must be built with the API URL; set this environment variable in the frontend host's production build configuration and redeploy:

```dotenv
VITE_API_URL=https://api-hiveborn.odin-matthias.de
```

Set `FRONTEND_URL=https://hiveborn.odin-matthias.de` in the backend `.env` (the setup script does this) so CORS and WebSocket origin checks permit the production site. In the shared WorkOS application, register this redirect URI before enabling sign-in:

```text
https://hiveborn.odin-matthias.de/auth/callback
```

The managed Caddy site proxies to `127.0.0.1:3003`. The port is loopback-only: do not add a public firewall rule for `3003`; Caddy is the public HTTPS endpoint on ports 80 and 443.

For routine deploys, run `/opt/hiveborn/backend/scripts/updateCode.sh` as `root` or `hiveborn`. It creates a timestamped SQLite backup under `backend/db_backups/`, fast-forward pulls the code, installs locked dependencies, builds, migrates, restarts PM2, and verifies the public health endpoint. This script is already present and is the Hiveborn equivalent of Progeny's `updateCode.sh`.

Useful production commands:

```bash
/opt/hiveborn/backend/scripts/pm2.sh status
/opt/hiveborn/backend/scripts/pm2.sh logs
/opt/hiveborn/backend/scripts/pm2.sh restart
```
