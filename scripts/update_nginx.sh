#!/bin/bash
# 添加 /admin/ nginx 反代到 3001
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

echo "=== backup existing config ==="
echo "$SUDO_PASSWORD" | sudo -S cp /etc/nginx/sites-enabled/liftmark /etc/nginx/sites-enabled/liftmark.bak.$(date +%Y%m%d_%H%M%S)

echo "=== write new config ==="
echo "$SUDO_PASSWORD" | sudo -S tee /etc/nginx/sites-enabled/liftmark > /dev/null <<'EOF'
server {
    listen 80;
    server_name 47.100.239.29;

    client_max_body_size 5m;

    # 用户上传文件 - 直接由 Fastify static 处理，但走 Nginx 比 /home/deploy 更稳
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    # 管理员控制台 - Next.js standalone @ port 3001
    location /admin/ {
        proxy_pass http://127.0.0.1:3001/admin/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    # /admin -> /admin/ (trailing slash)
    location = /admin {
        return 308 /admin/;
    }

    # 根路径 - 重定向到 /admin/
    location = / {
        return 302 /admin/;
    }
}
EOF

echo "=== test config ==="
echo "$SUDO_PASSWORD" | sudo -S nginx -t 2>&1

echo "=== reload nginx ==="
echo "$SUDO_PASSWORD" | sudo -S nginx -s reload 2>&1

echo "=== wait 2s ==="
sleep 2

echo "=== test endpoints ==="
echo "[/admin/login]"
curl -s -o /dev/null -w "HTTP:%{http_code} time:%{time_total}s\n" http://127.0.0.1/admin/login
echo "[/admin/api/auth/login - test API still works through nginx]"
curl -s -X POST http://127.0.0.1/api/admin/auth/login -H "Content-Type: application/json" -d "{\"account\":\"$ADMIN_PHONE\",\"password\":\"$ADMIN_PASSWORD\"}" -w "\nHTTP:%{http_code}\n" | tail -2
echo "[/admin/users (should redirect to /admin/login)]"
curl -s -o /dev/null -w "HTTP:%{http_code} time:%{time_total}s\n" http://127.0.0.1/admin/users

echo "=== done ==="
