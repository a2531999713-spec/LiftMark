#!/bin/bash
set -e

SRC=/home/deploy/liftmark/backend

cd "$SRC"

echo "=== 1. globals.css content ==="
cat app/globals.css | head -10

echo "=== 2. globals.css MD5 ==="
md5sum app/globals.css

echo "=== 3. tailwind.config.ts ==="
cat tailwind.config.ts

echo "=== 4. Clean ALL caches ==="
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/next-*
rm -rf /home/deploy/.next

echo "=== 5. Build with verbose ==="
NEXT_PRIVATE_DEBUG_CACHE=1 npm run build 2>&1 | grep -iE "globals|css|tailwind|source|content|warn" | head -30

echo "=== 6. Check CSS output ==="
ls -la .next/static/chunks/*.css
echo "MD5:"
md5sum .next/static/chunks/*.css
echo "Size:"
wc -c .next/static/chunks/*.css
echo "Has .flex:"
grep -c '\.flex{' .next/static/chunks/*.css || echo "NO"
echo "Has .min-h-screen:"
grep -c '\.min-h-screen{' .next/static/chunks/*.css || echo "NO"

echo "=== done ==="
