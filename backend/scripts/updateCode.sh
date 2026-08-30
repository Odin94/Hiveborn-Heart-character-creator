#!/bin/bash
set -euo pipefail

APP_USER="hiveborn"
APP_DIR="/opt/hiveborn"
BACKEND_DIR="$APP_DIR/backend"
APP_NAME="hiveborn-backend"
HEALTH_URL="https://api-hiveborn.odin-matthias.de/health"
DATABASE_FILE="data/hiveborn.sqlite"

run_app() {
    if [ "$(id -un)" = "$APP_USER" ]; then
        bash -lc "$1"
    elif [ "$EUID" -eq 0 ]; then
        runuser -u "$APP_USER" -- bash -lc "$1"
    else
        echo "Please run this script as root or $APP_USER."
        exit 1
    fi
}

if ! getent passwd "$APP_USER" >/dev/null 2>&1; then
    echo "User $APP_USER does not exist."
    exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
    echo "Backend directory does not exist: $BACKEND_DIR"
    exit 1
fi

if [ "$EUID" -eq 0 ]; then
    # Previous manual updates may have created Git objects or dependencies as root.
    # The service user must own the full application directory before it can update.
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

run_app "
    set -euo pipefail
    cd '$BACKEND_DIR'
    export CI=true
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    export npm_config_confirm_modules_purge=false

    if [ -f '$DATABASE_FILE' ]; then
        BACKUP_MONTH=\"\$(date +%Y_%m)\"
        BACKUP_DIR=\"db_backups/\$BACKUP_MONTH\"
        mkdir -p \"\$BACKUP_DIR\"
        BACKUP_FILE=\"\$BACKUP_DIR/hiveborn.sqlite.backup.\$(date +%Y%m%d_%H%M%S)\"
        cp '$DATABASE_FILE' \"\$BACKUP_FILE\"
        echo \"Backed up $DATABASE_FILE to \$BACKUP_FILE\"
    else
        echo \"No existing database at $DATABASE_FILE; skipping backup.\"
    fi

    git pull --ff-only
    echo 'Pulled latest code from git'

    corepack enable
    corepack pnpm install --frozen-lockfile --reporter=append-only
    echo 'Installed dependencies'

    corepack pnpm run build
    echo 'Built the code'

    corepack pnpm run db:migrate
    echo 'Migrated the database'

    pm2 restart '$APP_NAME'
    pm2 save
    echo 'Restarted the backend and saved PM2 process list'
"

echo "Waiting 5 seconds for backend to start..."
sleep 5

curl -fsS "$HEALTH_URL"
echo
echo "Use this for logs:"
echo "  sudo su - $APP_USER -c \"pm2 logs $APP_NAME\""
