#!/bin/bash
# 在服务器上构建并部署 admin console (standalone)
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

echo "=== step 1: install deps ==="
cd "$SRC"
npm ci --no-audit --no-fund --omit=dev 2>&1 | tail -3 || npm install --no-audit --no-fund 2>&1 | tail -3

echo "=== step 2: build standalone ==="
# 需要完整依赖来构建
npm install --no-audit --no-fund 2>&1 | tail -3
npm run build 2>&1 | tail -20

echo "=== step 3: prepare deploy dir ==="
rm -rf "$DEST"
mkdir -p "$DEST"

# 复制 standalone
cp -r "$SRC/.next/standalone/." "$DEST/"
# 复制静态资源
mkdir -p "$DEST/.next/static"
cp -r "$SRC/.next/static/." "$DEST/.next/static/"
# 复制 public
if [ -d "$SRC/public" ]; then
  mkdir -p "$DEST/public"
  cp -r "$SRC/public/." "$DEST/public/"
fi

echo "=== step 4: verify structure ==="
ls -la "$DEST" | head -20
echo "---"
find "$DEST" -maxdepth 3 -name "server.js" 2>/dev/null
echo "---"
find "$DEST" -maxdepth 3 -name "next" -type d 2>/dev/null

echo "=== step 5: write ecosystem config ==="
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
cat "$DEST/ecosystem.config.cjs"

echo "=== step 6: ensure logs dir ==="
mkdir -p /home/deploy/liftmark/logs

echo "=== step 7: find absolute server.js path ==="
SERVER_JS=$(find "$DEST" -name "server.js" -not -path "*/node_modules/*" | head -1)
echo "server.js at: $SERVER_JS"

# 如果 server.js 在嵌套路径下，把它移到根目录
if [ "$(dirname "$SERVER_JS")" != "$DEST" ]; then
  echo "moving server.js to root of $DEST..."
  # Next.js standalone 输出在 Linux 上正常应在根目录,但保险起见
  cd "$DEST"
  # 列出顶层目录
  ls -la
fi

echo "=== done ==="
