#!/usr/bin/env bash

set -euo pipefail

# One-click deploy to Hostinger VPS from macOS
# Usage: ./deploy-vps.sh

# Config
USER="root"
HOST="72.60.102.230"
DEST_DIR="/var/www/heic-to-jpg"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Optional: set a dedicated passwordless key to avoid prompts
# Generate once (no passphrase): ssh-keygen -t ed25519 -f ~/.ssh/hostinger -N ""
# Copy to server: ssh-copy-id -i ~/.ssh/hostinger.pub ${USER}@${HOST}
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger}"
SSH_BASE_OPTS_PUBLIC="-o StrictHostKeyChecking=no -o PreferredAuthentications=publickey -o PasswordAuthentication=no"
SSH_BASE_OPTS_PASSWORD="-o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no"

# Pick SSH options based on key availability
if [ -f "${SSH_KEY}" ]; then
  RSYNC_SSH="ssh -i ${SSH_KEY} ${SSH_BASE_OPTS_PUBLIC}"
  SSH_USE_KEY=1
else
  echo "==> SSH key ${SSH_KEY} not found. Falling back to password authentication."
  RSYNC_SSH="ssh ${SSH_BASE_OPTS_PASSWORD}"
  SSH_USE_KEY=0
fi

echo "==> Rsyncing project to ${USER}@${HOST}:${DEST_DIR}"
rsync -azh --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .DS_Store \
  --exclude .cursor \
  --exclude stats/*.json \
  --exclude '*.zip' \
  --exclude '.env' \
  -e "${RSYNC_SSH}" \
  "${LOCAL_DIR}/" "${USER}@${HOST}:${DEST_DIR}/"

echo "==> Installing dependencies and reloading services on VPS"

# Create remote commands as a variable
REMOTE_COMMANDS='
set -euo pipefail
cd /var/www/heic-to-jpg

# Install deps (prefer clean install if lockfile present)
if [ -f package-lock.json ]; then
  npm ci --omit=dev || npm install --omit=dev
else
  npm install --omit=dev
fi

# Ensure uploads/converted dirs exist
mkdir -p uploads public/converted

# Start or reload PM2 app (with dotenv preload)
if pm2 describe imgtojpg >/dev/null 2>&1; then
  pm2 reload imgtojpg || true
else
  PORT=3000 NODE_ENV=production pm2 start server.js --name imgtojpg --time --update-env --node-args="-r dotenv/config"
fi
pm2 save || true

# Reload nginx if config is valid
nginx -t && systemctl reload nginx || true

echo "PM2 status:"
pm2 status | cat
echo "Local app check:"
curl -sI http://localhost:3000 | head -n 1 || true
'

# Execute remote commands
if [ "${SSH_USE_KEY}" = "1" ]; then
  ssh -i "${SSH_KEY}" ${SSH_BASE_OPTS_PUBLIC} "${USER}@${HOST}" "bash -s" <<< "${REMOTE_COMMANDS}"
else
  ssh ${SSH_BASE_OPTS_PASSWORD} "${USER}@${HOST}" "bash -s" <<< "${REMOTE_COMMANDS}"
fi

echo "==> Deploy complete. Test: https://imgtojpg.org"

