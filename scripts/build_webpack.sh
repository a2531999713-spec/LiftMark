#!/bin/bash
# 用 webpack 构建而不是 Turbopack
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

cd "$SRC"

echo "=== clean ==="
rm -rf .next

echo "=== build with webpack (no turbopack) ==="
TURBOPACK=0 npm run build 2>&1 | tail -30

echo "=== check CSS ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS: $CSS_FILE size: $(wc -c < "$CSS_FILE") bytes"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE")"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE")"

echo "=== deploy ==="
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r .next/standalone/. "$DEST/"
mkdir -p "$DEST/.next/static"
cp -r .next/static/. "$DEST/.next/static/"
if [ -d public ]; then
  mkdir -p "$DEST/public"
  cp -r public/. "$DEST/public/"
fi

echo "=== verify deploy CSS ==="
DEPLOY_CSS=$(ls "$DEST/.next/static/chunks/"*.css 2>/dev/null | head -1)
echo "Deploy CSS size: $(wc -c < "$DEPLOY_CSS") bytes"
echo "Deploy Has .flex: $(grep -c '\.flex{' "$DEPLOY_CSS")"

echo "=== restart ==="
pm2 restart liftmark-admin --update-env 2>&1 | tail -3

echo "=== done ==="
