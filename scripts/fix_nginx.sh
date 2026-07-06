#!/bin/bash
# 修复 nginx /admin/ 重定向循环
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env" 2>/dev/null || true
set +a

if [[ -z "${SUDO_PASSWORD:-}" ]]; then
  echo "错误：请在 scripts/.env 中设置 SUDO_PASSWORD" >&2
  echo "参考：cp scripts/.env.example scripts/.env" >&2
  exit 1
fi

# 1. 写配置到 deploy 用户可写的临时文件
TMP=/tmp/liftmark_nginx.conf
cat > "$TMP" <<'EOF'
server {
    listen 80;
    server_name 47.100.239.29;

    client_max_body_size 5m;

    # 用户上传文件
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

    # 管理员控制台 - 前缀匹配同时处理 /admin 和 /admin/...
    # Next.js basePath=/admin, trailingSlash=false (默认)
    # /admin -> 200 (Next.js 渲染首页)
    # /admin/ -> 308 -> /admin (Next.js 去尾斜杠，浏览器跳转一次后停在 /admin)
    # /admin/login -> 200
    # /admin/_next/static/... -> 200
    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }

    # 根路径 - 重定向到 /admin (不带尾斜杠)
    location = / {
        return 302 /admin;
    }
}
EOF

echo "=== file written ==="
ls -la "$TMP"
wc -l "$TMP"

# 2. sudo 复制到 nginx 目录
echo "$SUDO_PASSWORD" | sudo -S cp "$TMP" /etc/nginx/sites-enabled/liftmark
echo "=== copied ==="

# 3. 测试配置
echo "$SUDO_PASSWORD" | sudo -S nginx -t 2>&1

# 4. reload
echo "$SUDO_PASSWORD" | sudo -S nginx -s reload 2>&1

echo "=== wait 2s ==="
sleep 2

echo "=== test endpoints (no follow) ==="
echo "[/]"
curl -s -o /dev/null -w "HTTP:%{http_code} loc:%{redirect_url}\n" http://127.0.0.1/
echo "[/admin]"
curl -s -o /dev/null -w "HTTP:%{http_code} loc:%{redirect_url}\n" http://127.0.0.1/admin
echo "[/admin/]"
curl -s -o /dev/null -w "HTTP:%{http_code} loc:%{redirect_url}\n" http://127.0.0.1/admin/
echo "[/admin/login]"
curl -s -o /dev/null -w "HTTP:%{http_code} loc:%{redirect_url}\n" http://127.0.0.1/admin/login

echo "=== follow chain from /admin/ ==="
curl -s -L -o /dev/null -w "Final HTTP:%{http_code} url:%{url_effective} redirects:%{num_redirects}\n" http://127.0.0.1/admin/

echo "=== follow chain from / ==="
curl -s -L -o /dev/null -w "Final HTTP:%{http_code} url:%{url_effective} redirects:%{num_redirects}\n" http://127.0.0.1/

echo "=== done ==="
