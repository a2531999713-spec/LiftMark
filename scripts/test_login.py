"""测试 admin 登录端点"""
import json
import os
from pathlib import Path
import urllib.request

# 加载同目录下的 .env（不提交到 Git）
env_path = Path(__file__).with_name(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key, value)

ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
if not ADMIN_PHONE or not ADMIN_PASSWORD:
    raise SystemExit("请在 scripts/.env 中设置 ADMIN_PHONE 和 ADMIN_PASSWORD，参考 scripts/.env.example")

url = "http://47.100.239.29/api/admin/auth/login"
payload = {"account": ADMIN_PHONE, "password": ADMIN_PASSWORD}
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    url,
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print("HTTP", resp.status)
        body = resp.read().decode("utf-8")
        print(body[:800])
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode("utf-8")[:800])
except Exception as e:
    print("ERR", type(e).__name__, e)
