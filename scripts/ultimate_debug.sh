#!/bin/bash
# 终极排查：对比本地和服务器构建差异
set -e

SRC=/home/deploy/liftmark/backend

cd "$SRC"

echo "=== 1. node version ==="
node -v

echo "=== 2. npm version ==="
npm -v

echo "=== 3. tailwindcss version ==="
node -e 'console.log(require("./node_modules/tailwindcss/package.json").version)'

echo "=== 4. next version ==="
node -e 'console.log(require("./node_modules/next/package.json").version)'

echo "=== 5. globals.css ==="
cat app/globals.css | head -8

echo "=== 6. tailwind.config.ts ==="
cat tailwind.config.ts

echo "=== 7. postcss.config.mjs ==="
cat postcss.config.mjs

echo "=== 8. Check if @tailwindcss/postcss is actually used ==="
echo "--- postcss plugins in node_modules ---"
ls node_modules/@tailwindcss/postcss/dist/ 2>/dev/null | head -5

echo "=== 9. Nuke everything ==="
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/next-*

echo "=== 10. Build ==="
npm run build 2>&1

echo "=== 11. CSS check ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS: $CSS_FILE"
echo "Size: $(wc -c < "$CSS_FILE") bytes"
echo "MD5: $(md5sum "$CSS_FILE")"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE" || echo 0)"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE" || echo 0)"
echo "Has .bg-background: $(grep -c '\.bg-background{' "$CSS_FILE" || echo 0)"
echo "Has .text-sm: $(grep -c '\.text-sm{' "$CSS_FILE" || echo 0)"

echo "=== 12. Check if CSS has ANY utility classes ==="
grep -oP '\.[a-z][a-z0-9-]+\{' "$CSS_FILE" | head -20

echo "=== done ==="
