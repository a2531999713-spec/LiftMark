"""测试 admin 完整流程：登录→访问 dashboard→拉取用户列表"""
import json
import os
from pathlib import Path
import urllib.request
import urllib.parse

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

BASE = "http://47.100.239.29"
API = f"{BASE}/api"

# 1. 浏览器视角: GET /admin/login 应该返回 HTML
print("=== [1] GET /admin/login (HTML) ===")
req = urllib.request.Request(f"{BASE}/admin/login", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    body = resp.read().decode("utf-8", errors="replace")
    has_form = 'type="password"' in body or 'name="password"' in body
    print(f"  HTTP {resp.status}, length={len(body)}, has_login_form={has_form}")
    if "doctype html" in body[:200].lower():
        print("  -> HTML doctype present, looks like real page")
    else:
        print("  -> WARNING: first 200 chars:", body[:200])

# 2. API 登录
print("\n=== [2] POST /api/admin/auth/login ===")
payload = {"account": ADMIN_PHONE, "password": ADMIN_PASSWORD}
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    f"{API}/admin/auth/login",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=10) as resp:
    result = json.loads(resp.read())
    token = result["accessToken"]
    print(f"  HTTP {resp.status}, token={token[:30]}..., user={result['user']['nickname']}")

# 3. 测试已登录的 dashboard 数据
print("\n=== [3] GET /api/admin/dashboard/stats (with token) ===")
req = urllib.request.Request(
    f"{API}/admin/dashboard/stats",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=10) as resp:
    stats = json.loads(resp.read())
    print(f"  HTTP {resp.status}")
    print(f"  stats keys: {list(stats.get('stats', {}).keys())[:5]}")

# 4. 测试静态资源
print("\n=== [4] GET /admin/_next/static/... ===")
# 从登录页 HTML 提取一个静态资源
import re
matches = re.findall(r'(/admin/_next/static/[^"\s]+\.js)', body)
if matches:
    static_path = matches[0]
    print(f"  testing: {static_path}")
    req = urllib.request.Request(f"{BASE}{static_path}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read()
        print(f"  HTTP {resp.status}, size={len(body)} bytes")
else:
    print("  no static assets found in login page HTML")
    # 检查是否是 next.js standalone 输出的问题
    print("  HTML snippet:")
    print(body[:500] if isinstance(body, str) else "(bytes)")

# 5. 测试根路径
print("\n=== [5] GET / (should redirect to /admin/) ===")
opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
opener = urllib.request.build_opener(NoRedirect)
try:
    opener.open(f"{BASE}/")
except urllib.error.HTTPError as e:
    print(f"  HTTP {e.code}, Location: {e.headers.get('Location')}")

print("\n=== Done ===")
