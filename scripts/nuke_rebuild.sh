#!/bin/bash
# 彻底清理所有缓存重建
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

cd "$SRC"

echo "=== 1. nuke everything ==="
rm -rf .next node_modules/.cache ~/.npm/_cacache /tmp/next-*

echo "=== 2. verify globals.css ==="
cat app/globals.css | head -5

echo "=== 3. build ==="
npm run build 2>&1 | tail -20

echo "=== 4. check CSS ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS: $CSS_FILE size: $(wc -c < "$CSS_FILE") bytes"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE")"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE")"
echo "Has .bg-background: $(grep -c '\.bg-background{' "$CSS_FILE")"

echo "=== 5. deploy ==="
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r .next/standalone/. "$DEST/"
mkdir -p "$DEST/.next/static"
cp -r .next/static/. "$DEST/.next/static/"
if [ -d public ]; then
  mkdir -p "$DEST/public"
  cp -r public/. "$DEST/public/"
fi

echo "=== 6. verify deploy CSS ==="
DEPLOY_CSS=$(ls "$DEST/.next/static/chunks/"*.css 2>/dev/null | head -1)
echo "Deploy CSS size: $(wc -c < "$DEPLOY_CSS") bytes"
echo "Deploy Has .flex: $(grep -c '\.flex{' "$DEPLOY_CSS")"

echo "=== 7. restart ==="
pm2 restart liftmark-admin --update-env 2>&1 | tail -3

echo "=== done ==="
