#!/bin/bash
echo "=== server next version ==="
node -e 'console.log("next:", require("next/package.json").version)'
echo "=== server tailwindcss version ==="
node -e 'console.log("tailwindcss:", require("tailwindcss/package.json").version)'
echo "=== server @tailwindcss/postcss ==="
node -e 'console.log("@tailwindcss/postcss:", require("@tailwindcss/postcss/package.json").version)'
echo "=== server node version ==="
node -v
echo "=== server npm version ==="
npm -v
echo "=== local next version ==="
cd /home/deploy/liftmark/backend
cat package.json | python3 -c 'import sys,json;d=json.load(sys.stdin);print("next:", d["dependencies"]["next"])'
echo "=== rebuild with tailwind.config.ts ==="
rm -rf .next
npm run build 2>&1 | tail -10
echo "=== check CSS ==="
CSS_FILE=$(ls .next/static/chunks/*.css 2>/dev/null | head -1)
echo "CSS: $CSS_FILE size: $(wc -c < "$CSS_FILE") bytes"
echo "Has .flex: $(grep -c '\.flex{' "$CSS_FILE")"
echo "Has .min-h-screen: $(grep -c '\.min-h-screen{' "$CSS_FILE")"
