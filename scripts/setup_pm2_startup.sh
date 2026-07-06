#!/bin/bash
# 配置 PM2 开机自启
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env" 2>/dev/null || true
set +a

if [[ -z "${SUDO_PASSWORD:-}" ]]; then
  echo "错误：请在 scripts/.env 中设置 SUDO_PASSWORD" >&2
  echo "参考：cp scripts/.env.example scripts/.env" >&2
  exit 1
fi

echo "$SUDO_PASSWORD" | sudo -S env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy 2>&1 | tail -10
echo "=== save ==="
pm2 save 2>&1 | tail -3
echo "=== verify systemd service ==="
systemctl status pm2-deploy 2>&1 | head -5 || echo "pm2-deploy service not found"
