#!/bin/bash
# 完全清理重建 - 分步执行，每步检查
set -e

SRC=/home/deploy/liftmark/backend
DEST=/home/deploy/liftmark/admin-deploy

cd "$SRC"

echo "=== step 1: clean ==="
rm -rf .next node_modules package-lock.json

echo "=== step 2: npm install ==="
npm install 2>&1 | tail -5
echo "install exit: $?"

echo "=== step 3: verify install ==="
ls node_modules/tailwindcss/package.json && echo "tailwindcss OK"
ls node_modules/@tailwindcss/postcss/dist/index.js && echo "@tailwindcss/postcss OK"

echo "=== step 4: globals.css ==="
head -6 app/globals.css
echo "---"
ls tailwind.config.ts && echo "tailwind.config.ts exists"

echo "=== step 5: build ==="
npm run build 2>&1
echo "build exit: $?"

echo "=== step 6: check CSS ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS file: $CSS_FILE"
echo "CSS size: $(wc -c < "$CSS_FILE") bytes"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE")"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE")"

echo "=== step 7: deploy ==="
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r .next/standalone/. "$DEST/"
mkdir -p "$DEST/.next/static"
cp -r .next/static/. "$DEST/.next/static/"
if [ -d public ]; then
  mkdir -p "$DEST/public"
  cp -r public/. "$DEST/public/"
fi

echo "=== step 8: verify deploy ==="
DEPLOY_CSS=$(ls "$DEST/.next/static/chunks/"*.css 2>/dev/null | head -1)
echo "Deploy CSS: $DEPLOY_CSS"
echo "Deploy CSS size: $(wc -c < "$DEPLOY_CSS") bytes"
echo "Deploy Has .flex: $(grep -c '\.flex{' "$DEPLOY_CSS")"

echo "=== step 9: restart ==="
pm2 restart liftmark-admin --update-env 2>&1 | tail -3

echo "=== done ==="
