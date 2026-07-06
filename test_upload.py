#!/usr/bin/env python3
import os
from pathlib import Path
import urllib.request
import json

# 加载项目根目录 .env（不提交到 Git）
env_path = Path(__file__).with_name(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key, value)

PHONE = os.environ.get("ADMIN_PHONE", "")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
if not PHONE or not PASSWORD:
    raise SystemExit("请在项目根目录 .env 中设置 ADMIN_PHONE 和 ADMIN_PASSWORD")

# Login - try phone-based login instead
login_data = json.dumps({"phone": PHONE, "code": "000000"}).encode()
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
