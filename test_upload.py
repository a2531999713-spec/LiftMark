#!/usr/bin/env python3
import urllib.request
import json

# Login - try phone-based login instead
login_data = json.dumps({"phone": "17606108291", "code": "000000"}).encode()
req = urllib.request.Request("http://127.0.0.1:3000/api/auth/login-with-code",
    data=login_data, headers={"Content-Type": "application/json"})
try:
    resp = json.loads(urllib.request.urlopen(req).read())
    token = resp.get("session", {}).get("accessToken", "")
    print(f"Token length: {len(token)}")
    if not token:
        print(f"Login response: {json.dumps(resp, indent=2)}")
except Exception as e:
    print(f"Login error: {e}")

# Try direct user check
req3 = urllib.request.Request("http://127.0.0.1:3000/api/auth/me")
try:
    resp3 = urllib.request.urlopen(req3)
except urllib.error.HTTPError as e:
    print(f"Auth check (no token): {e.code}")
