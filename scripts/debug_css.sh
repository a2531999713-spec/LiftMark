#!/bin/bash
# 检查服务器构建到底用了哪个 CSS 源
set -e

SRC=/home/deploy/liftmark/backend

cd "$SRC"

echo "=== 1. globals.css MD5 ==="
md5sum app/globals.css

echo "=== 2. Check if postcss is processing globals.css ==="
echo "--- postcss.config.mjs ---"
cat postcss.config.mjs

echo "=== 3. Check if there's a tailwind cache ==="
find . -name ".tailwind*" -o -name "tailwindcache*" 2>/dev/null | head -10
find /tmp -name "*tailwind*" 2>/dev/null | head -5
find /home/deploy -name ".tailwind*" 2>/dev/null | head -5

echo "=== 4. Check next cache ==="
ls -la .next/cache/ 2>/dev/null | head -10
du -sh .next/cache/ 2>/dev/null

echo "=== 5. Full clean and rebuild ==="
rm -rf .next
rm -rf node_modules/.cache

echo "=== 6. Rebuild ==="
npm run build 2>&1 | grep -iE "compiled|css|globals|tailwind|warn|error" | head -20

echo "=== 7. Check new CSS ==="
ls -la .next/static/chunks/*.css
echo "MD5:"
md5sum .next/static/chunks/*.css
echo "Size:"
wc -c .next/static/chunks/*.css
echo "Has .flex:"
grep -c '\.flex{' .next/static/chunks/*.css || echo "0"

echo "=== done ==="
