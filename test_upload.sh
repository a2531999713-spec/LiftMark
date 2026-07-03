#!/bin/bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/password/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin","password":"lianke969"}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get("session",{}).get("accessToken",""))')

echo "Token length: ${#TOKEN}"

echo 'test image data' > /tmp/test.jpg
RESULT=$(curl -s -X POST http://127.0.0.1:3000/api/auth/avatar/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@/tmp/test.jpg;type=image/jpeg')
echo "Upload result: $RESULT"
