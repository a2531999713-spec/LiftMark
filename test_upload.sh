#!/bin/bash
set -e

# 加载项目根目录 .env（不提交到 Git）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/.env" 2>/dev/null || true
set +a

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "错误：请在项目根目录 .env 中设置 ADMIN_PASSWORD" >&2
  exit 1
fi

TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/password/login \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"admin\",\"password\":\"$ADMIN_PASSWORD\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("session",{}).get("accessToken",""))')

echo "Token length: ${#TOKEN}"

echo 'test image data' > /tmp/test.jpg
RESULT=$(curl -s -X POST http://127.0.0.1:3000/api/auth/avatar/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@/tmp/test.jpg;type=image/jpeg')
echo "Upload result: $RESULT"
