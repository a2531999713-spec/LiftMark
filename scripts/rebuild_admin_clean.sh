#!/bin/bash
# 彻底清理重建 admin console
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

cd "$SRC"

echo "=== 1. clean ==="
rm -rf .next node_modules package-lock.json

echo "=== 2. fresh install ==="
npm install 2>&1 | tail -10

echo "=== 3. versions ==="
node -e 'console.log("tailwindcss:", require("tailwindcss/package.json").version)'
node -e 'console.log("@tailwindcss/postcss:", require("@tailwindcss/postcss/package.json").version)'

echo "=== 4. globals.css ==="
head -6 app/globals.css

echo "=== 5. build ==="
npm run build 2>&1 | tail -40

echo "=== 6. check CSS ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS file: $CSS_FILE"
echo "CSS size: $(wc -c < "$CSS_FILE") bytes"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE")"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE")"
echo "Has .bg-background: $(grep -c '\.bg-background{' "$CSS_FILE")"

echo "=== 7. deploy ==="
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r .next/standalone/. "$DEST/"
mkdir -p "$DEST/.next/static"
cp -r .next/static/. "$DEST/.next/static/"
if [ -d public ]; then
  mkdir -p "$DEST/public"
  cp -r public/. "$DEST/public/"
fi

echo "=== 8. verify deploy CSS ==="
DEPLOY_CSS=$(ls "$DEST/.next/static/chunks/"*.css 2>/dev/null | head -1)
echo "Deploy CSS: $DEPLOY_CSS"
echo "Deploy CSS size: $(wc -c < "$DEPLOY_CSS") bytes"
echo "Deploy Has .flex: $(grep -c '\.flex{' "$DEPLOY_CSS")"

echo "=== 9. restart ==="
pm2 restart liftmark-admin --update-env 2>&1 | tail -3

echo "=== done ==="
