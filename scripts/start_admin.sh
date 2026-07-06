#!/bin/bash
# 启动 liftmark-admin PM2 进程 (deploy user)
set -e

DEST=/home/deploy/liftmark/admin-deploy

# 写 ecosystem.config.cjs
cat > "$DEST/ecosystem.config.cjs" <<'EOF'
module.exports = {
  apps: [{
    name: 'liftmark-admin',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOSTNAME: '127.0.0.1',
    },
    error_file: '/home/deploy/liftmark/logs/liftmark-admin.err.log',
    out_file: '/home/deploy/liftmark/logs/liftmark-admin.out.log',
    time: true,
  }]
}
EOF

mkdir -p /home/deploy/liftmark/logs

echo "=== delete if exists ==="
pm2 delete liftmark-admin 2>/dev/null || echo "(not running, ok)"

echo "=== start ==="
cd "$DEST"
pm2 start ecosystem.config.cjs 2>&1 | tail -15

echo "=== save ==="
pm2 save --force 2>&1 | tail -3

echo "=== wait 3s ==="
sleep 3

echo "=== list ==="
pm2 list 2>&1 | tail -10

echo "=== test local ==="
curl -s -o /dev/null -w "HTTP:%{http_code} time:%{time_total}s\n" http://127.0.0.1:3001/ 2>&1
curl -s -o /dev/null -w "HTTP:%{http_code} time:%{time_total}s\n" http://127.0.0.1:3001/login 2>&1
curl -s -o /dev/null -w "HTTP:%{http_code} time:%{time_total}s\n" http://127.0.0.1:3001/users 2>&1

echo "=== logs tail ==="
pm2 logs liftmark-admin --lines 10 --nostream 2>&1 | tail -15

echo "=== done ==="
