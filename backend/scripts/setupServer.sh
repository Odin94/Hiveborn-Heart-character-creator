#!/bin/bash
# First-time Hiveborn backend setup for an Ubuntu Hetzner server.
#
# Run this *on the server* as root, after api-hiveborn.odin-matthias.de has
# an A/AAAA record pointing here:
#   curl -fsSLO https://raw.githubusercontent.com/Odin94/Hiveborn-Heart-character-creator/main/backend/scripts/setupServer.sh
#   chmod +x setupServer.sh
#   ./setupServer.sh
#
# The script deliberately manages only the api-hiveborn Caddy site. It leaves
# the Progeny and Cozy Crowns sites alone, and makes a timestamped backup of
# the Caddyfile before changing that one site block.

set -euo pipefail

APP_USER="hiveborn"
APP_DIR="/opt/hiveborn"
BACKEND_DIR="$APP_DIR/backend"
APP_NAME="hiveborn-backend"
REPOSITORY_URL="https://github.com/Odin94/Hiveborn-Heart-character-creator.git"
API_HOST="api-hiveborn.odin-matthias.de"
API_URL="https://$API_HOST"
FRONTEND_URL="https://hiveborn.odin-matthias.de"
BACKEND_PORT="3003"
CADDYFILE="/etc/caddy/Caddyfile"
ENV_FILE="$BACKEND_DIR/.env"

if [ "${EUID}" -ne 0 ]; then
    echo "Please run this script as root."
    exit 1
fi

if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
fi

run_app() {
    runuser -u "$APP_USER" -- bash -lc "export PNPM_HOME=/usr/local/pnpm; export PATH=\$PNPM_HOME:\$PATH; $1"
}

install_caddy() {
    if command -v caddy >/dev/null 2>&1; then
        echo "Caddy is already installed."
        return
    fi

    echo "Installing Caddy..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
    chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
}

configure_caddy() {
    local temporary_caddyfile backup_file site_count

    if [ ! -f "$CADDYFILE" ]; then
        echo "Expected Caddyfile does not exist: $CADDYFILE"
        exit 1
    fi

    site_count=$(awk -v host="$API_HOST" '$1 == host && $2 == "{" { count++ } END { print count + 0 }' "$CADDYFILE")
    if [ "$site_count" -gt 1 ]; then
        echo "Found $site_count existing $API_HOST site blocks in $CADDYFILE; refusing to choose one to replace."
        exit 1
    fi

    install -d -o caddy -g caddy -m 0755 /var/log/caddy
    backup_file="${CADDYFILE}.before-hiveborn.$(date +%Y%m%d_%H%M%S)"
    cp -a "$CADDYFILE" "$backup_file"
    temporary_caddyfile=$(mktemp "${CADDYFILE}.hiveborn.XXXXXX")

    # Replace an existing api-hiveborn site, including the obsolete port-3002
    # block created by Progeny's old shared setup script. Otherwise append it.
    awk -v host="$API_HOST" -v port="$BACKEND_PORT" '
        function write_hiveborn_site() {
            print host " {"
            print "    reverse_proxy 127.0.0.1:" port
            print ""
            print "    log {"
            print "        output file /var/log/caddy/hiveborn.log"
            print "    }"
            print "}"
        }
        BEGIN { in_site = 0; depth = 0; replaced = 0 }
        {
            if (!in_site && $1 == host && $2 == "{") {
                in_site = 1
                depth = 0
            }

            if (in_site) {
                opening = gsub(/\{/, "{", $0)
                closing = gsub(/\}/, "}", $0)
                depth += opening - closing
                if (depth == 0) {
                    write_hiveborn_site()
                    in_site = 0
                    replaced = 1
                }
                next
            }

            print
        }
        END {
            if (!replaced) {
                print ""
                write_hiveborn_site()
            }
        }
    ' "$CADDYFILE" >"$temporary_caddyfile"

    caddy validate --config "$temporary_caddyfile" --adapter caddyfile
    chown root:caddy "$temporary_caddyfile"
    chmod 0640 "$temporary_caddyfile"
    mv "$temporary_caddyfile" "$CADDYFILE"
    systemctl enable --now caddy
    systemctl reload caddy
    echo "Configured Caddy for $API_URL (backup: $backup_file)."
}

write_environment_file() {
    if [ -f "$ENV_FILE" ]; then
        echo "Keeping existing environment file: $ENV_FILE"
        return
    fi

    if [ "$INTERACTIVE" != true ]; then
        echo "No $ENV_FILE exists and this is not an interactive terminal."
        echo "Create it from backend/.env.sample with production values, then rerun this script."
        exit 1
    fi

    local workos_api_key workos_client_id workos_cookie_password posthog_key
    read -r -s -p "WorkOS API key: " workos_api_key
    echo
    read -r -p "WorkOS client ID: " workos_client_id
    read -r -s -p "WorkOS cookie password (32+ characters): " workos_cookie_password
    echo
    read -r -p "PostHog key (optional; press Enter to skip): " posthog_key

    if [ -z "$workos_api_key" ] || [ -z "$workos_client_id" ] || [ "${#workos_cookie_password}" -lt 32 ]; then
        echo "WorkOS API key, client ID, and a cookie password of at least 32 characters are required."
        exit 1
    fi

    umask 077
    cat >"$ENV_FILE" <<EOF
WORKOS_API_KEY=$workos_api_key
WORKOS_CLIENT_ID=$workos_client_id
WORKOS_COOKIE_PASSWORD=$workos_cookie_password
PUBLIC_POSTHOG_KEY=$posthog_key
PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NODE_ENV=production
PORT=$BACKEND_PORT
HOST=localhost
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$API_URL
DATABASE_URL=./data/hiveborn.sqlite
EOF
    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 0600 "$ENV_FILE"
}

echo "Setting up Hiveborn at $APP_DIR..."
apt-get update
apt-get install -y ca-certificates curl git build-essential sqlite3 libcap2-bin gpg
install_caddy

if ! command -v node >/dev/null 2>&1 || [ "$(node --version | cut -d. -f1 | tr -d v)" -lt 24 ]; then
    echo "Installing Node.js 24..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
fi

corepack enable
install -d -m 0755 /usr/local/pnpm
cat >/etc/profile.d/pnpm.sh <<'EOF'
export PNPM_HOME="/usr/local/pnpm"
export PATH="$PNPM_HOME:$PATH"
EOF
chmod 0644 /etc/profile.d/pnpm.sh
export PNPM_HOME=/usr/local/pnpm
export PATH="$PNPM_HOME:$PATH"
corepack prepare pnpm@10.33.0 --activate

if ! command -v pm2 >/dev/null 2>&1; then
    pnpm add -g pm2
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
    # Do not create a skeleton home directory: git must clone into an empty
    # /opt/hiveborn directory on the first setup.
    useradd -r -s /bin/bash -d "$APP_DIR" -M "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$APP_DIR" /var/log/hiveborn-backend
# A first clone may have been made as root before this setup script runs.
# Hand it to the service user before asking that user to fast-forward it.
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
    run_app "git -C '$APP_DIR' pull --ff-only"
elif [ -e "$APP_DIR" ] && [ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
    echo "$APP_DIR exists but is not a Hiveborn git checkout; refusing to overwrite it."
    exit 1
else
    run_app "git clone '$REPOSITORY_URL' '$APP_DIR'"
fi

write_environment_file
run_app "cd '$BACKEND_DIR' && corepack pnpm install --frozen-lockfile --reporter=append-only && corepack pnpm run build && corepack pnpm run db:migrate"
run_app "cd '$BACKEND_DIR' && pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save"

systemctl stop "pm2-$APP_USER" >/dev/null 2>&1 || true
systemctl disable "pm2-$APP_USER" >/dev/null 2>&1 || true
rm -f "/etc/systemd/system/pm2-$APP_USER.service"
systemctl daemon-reload
PM2_STARTUP=$(run_app "pm2 startup systemd -u '$APP_USER' --hp '$APP_DIR'" | grep '^sudo env ' | tail -n 1 || true)
if [ -z "$PM2_STARTUP" ]; then
    echo "Could not generate the PM2 systemd startup command."
    exit 1
fi
eval "$PM2_STARTUP"
run_app "pm2 save"

configure_caddy

echo "Waiting for Hiveborn to start..."
sleep 3
curl -fsS "$API_URL/health"
echo
echo "Hiveborn is ready. Routine deploys: $BACKEND_DIR/scripts/updateCode.sh"
