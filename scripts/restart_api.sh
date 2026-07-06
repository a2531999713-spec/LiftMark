#!/bin/bash
# 重启 root PM2 的 liftmark-api 进程以加载新代码
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env" 2>/dev/null || true
set +a

if [[ -z "${SUDO_PASSWORD:-}" || -z "${ADMIN_PHONE:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "错误：请在 scripts/.env 中设置 SUDO_PASSWORD、ADMIN_PHONE、ADMIN_PASSWORD" >&2
  echo "参考：cp scripts/.env.example scripts/.env" >&2
  exit 1
fi

echo "=== step 1: stop deploy user pm2 liftmark-api (if exists) ==="
pm2 delete liftmark-api 2>/dev/null || echo "deploy pm2 has no liftmark-api (ok)"
pm2 save --force 2>/dev/null || true

echo "=== step 2: restart root pm2 liftmark-api via login shell ==="
echo "$SUDO_PASSWORD" | sudo -S -i bash -c '
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v22.5.1/bin:/home/deploy/.nvm/versions/node/v22.5.1/bin
  which pm2
  pm2 restart liftmark-api --update-env 2>&1 | tail -20
  pm2 save --force 2>&1 | tail -5
' 2>&1 | tail -30

echo "=== step 3: wait 5s and check status ==="
sleep 5
echo "$SUDO_PASSWORD" | sudo -S pm2 list 2>&1 | tail -10

echo "=== step 4: check port 3000 ==="
ss -tlnp 2>/dev/null | grep ':3000' || echo "no listener on 3000"

echo "=== step 5: test admin login endpoint ==="
curl -s -X POST http://127.0.0.1:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"account\":\"$ADMIN_PHONE\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -w "\nHTTP:%{http_code}\n" 2>&1 | tail -5

echo "=== done ==="
