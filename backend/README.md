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

The first deployment assumes Node.js 24+, Corepack/pnpm 10, PM2, Caddy, Git, and SQLite are already installed on the server (as they are for Progeny). Run the following as `root`, substituting the repository URL only if it differs:

```bash
useradd -r -s /bin/bash -d /opt/hiveborn -m hiveborn
install -d -o hiveborn -g hiveborn /var/log/hiveborn-backend
runuser -u hiveborn -- git clone https://github.com/Odin94/Hiveborn-Heart-character-creator.git /opt/hiveborn
runuser -u hiveborn -- bash -lc 'cd /opt/hiveborn/backend && corepack enable && pnpm install --frozen-lockfile && pnpm run build'
```

Create `/opt/hiveborn/backend/.env`, owned by `hiveborn`, with the production secrets and URLs:

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

Apply migrations and start the service:

```bash
runuser -u hiveborn -- bash -lc 'cd /opt/hiveborn/backend && pnpm run db:migrate && pm2 start ecosystem.config.cjs && pm2 save'
pm2 startup systemd -u hiveborn --hp /opt/hiveborn
# Run the sudo command printed by the preceding command, then:
systemctl enable --now pm2-hiveborn
```

Replace or add the `api-hiveborn.odin-matthias.de` site block in `/etc/caddy/Caddyfile` with this configuration. It intentionally uses port `3003`; an older shared Caddy template used `3002`, which does not match Hiveborn's backend configuration.

```caddyfile
api-hiveborn.odin-matthias.de {
    reverse_proxy 127.0.0.1:3003

    log {
        output file /var/log/caddy/hiveborn.log
    }
}
```

Once the DNS A/AAAA records for `api-hiveborn.odin-matthias.de` point to the server, validate and reload Caddy:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl -fsS https://api-hiveborn.odin-matthias.de/health
```

For routine deploys, run `/opt/hiveborn/backend/scripts/updateCode.sh` as `root` or `hiveborn`. It creates a timestamped SQLite backup under `backend/db_backups/`, fast-forward pulls the code, installs locked dependencies, builds, migrates, restarts PM2, and verifies the public health endpoint.

Useful production commands:

```bash
/opt/hiveborn/backend/scripts/pm2.sh status
/opt/hiveborn/backend/scripts/pm2.sh logs
/opt/hiveborn/backend/scripts/pm2.sh restart
```
