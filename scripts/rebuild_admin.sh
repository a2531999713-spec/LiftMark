#!/bin/bash
# 清理并重新构建 admin console
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

cd "$SRC"

echo "=== clean .next cache ==="
rm -rf .next
rm -rf node_modules/.cache

echo "=== verify tw-animate-css installed ==="
ls node_modules/tw-animate-css/dist/
echo "---"
ls node_modules/shadcn/ 2>&1 | head -5
echo "---"
ls node_modules/@tailwindcss/postcss/ 2>&1 | head -5

echo "=== run build ==="
npm run build 2>&1 | tail -40

echo "=== check standalone output ==="
ls -la .next/standalone/ 2>&1 | head -10
echo "---"
find .next/standalone -maxdepth 4 -name "server.js" 2>&1 | head -5

echo "=== prepare deploy dir ==="
rm -rf "$DEST"
mkdir -p "$DEST"

cp -r .next/standalone/. "$DEST/"
mkdir -p "$DEST/.next/static"
cp -r .next/static/. "$DEST/.next/static/"
if [ -d public ]; then
  mkdir -p "$DEST/public"
  cp -r public/. "$DEST/public/"
fi

echo "=== verify deploy structure ==="
ls -la "$DEST" | head -15
echo "---"
find "$DEST" -maxdepth 4 -name "server.js" 2>/dev/null
echo "---"
ls "$DEST/node_modules/" 2>&1 | head -20

echo "=== done ==="
