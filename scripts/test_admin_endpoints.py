"""测试 admin 各端点"""
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

BASE = "http://47.100.239.29/api"

# 登录获取 token
login_payload = {"account": ADMIN_PHONE, "password": ADMIN_PASSWORD}
req = urllib.request.Request(
    f"{BASE}/admin/auth/login",
    data=json.dumps(login_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=10) as resp:
    token = json.loads(resp.read())["accessToken"]
print("LOGIN OK, token:", token[:30] + "...")

# 测试各端点
endpoints = [
    ("GET", "/admin/dashboard/stats"),
    ("GET", "/admin/users/search?q="),
    ("GET", "/admin/monitor"),
    ("GET", "/admin/groups"),
    ("GET", "/admin/memberships"),
    ("GET", "/admin/orders"),
    ("GET", "/admin/sync/tasks"),
    ("GET", "/admin/devices"),
    ("GET", "/admin/feedback"),
    ("GET", "/admin/announcements"),
    ("GET", "/admin/version-configs"),
    ("GET", "/admin/audit-logs"),
    ("GET", "/admin/corrections"),
    ("GET", "/admin/admins"),
]

for method, path in endpoints:
    try:
        req = urllib.request.Request(
            f"{BASE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            method=method,
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            preview = body[:120].replace("\n", " ")
            print(f"  [{resp.status}] {method} {path} -> {preview}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")[:200]
        print(f"  [{e.code}] {method} {path} -> ERR: {body}")
    except Exception as e:
        print(f"  [ERR] {method} {path} -> {type(e).__name__}: {e}")
