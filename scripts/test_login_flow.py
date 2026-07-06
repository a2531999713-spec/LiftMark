"""详细测试登录流程 - 模拟浏览器行为"""
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

BASE = "http://47.100.239.29"

# 1. 检查登录页 HTML 是否能加载
print("=== [1] GET /admin/login HTML ===")
req = urllib.request.Request(f"{BASE}/admin/login", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    body = resp.read().decode("utf-8", errors="replace")
    print(f"  HTTP {resp.status}, length={len(body)}")
    print(f"  has password field: {'type=\"password\"' in body}")
    print(f"  has form: {'<form' in body}")
    # 找 form action
    import re
    form_match = re.search(r'<form[^>]*action="([^"]*)"', body)
    if form_match:
        print(f"  form action: {form_match.group(1)}")
    # 找 API_BASE 或 fetch URL
    api_match = re.search(r'(?:API_BASE|api\.|fetch\()["\']?([^"\']+admin/auth/login[^"\']*)["\']?', body)
    if api_match:
        print(f"  API endpoint hint: {api_match.group(1)}")

# 2. 调用 API 登录
print("\n=== [2] POST /api/admin/auth/login ===")
payload = {"account": ADMIN_PHONE, "password": ADMIN_PASSWORD}
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    f"{BASE}/api/admin/auth/login",
    data=data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())
        print(f"  HTTP {resp.status}")
        print(f"  accessToken: {result.get('accessToken', 'MISSING')[:40]}...")
        print(f"  refreshToken: {result.get('refreshToken', 'MISSING')[:30]}...")
        print(f"  user: {result.get('user', {})}")
except urllib.error.HTTPError as e:
    print(f"  HTTP {e.code}")
    print(f"  body: {e.read().decode('utf-8')}")

# 3. 用 token 访问 dashboard
print("\n=== [3] GET /api/admin/dashboard/stats (with token) ===")
token = result["accessToken"]
req = urllib.request.Request(
    f"{BASE}/api/admin/dashboard/stats",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=10) as resp:
    print(f"  HTTP {resp.status}")
    stats = json.loads(resp.read())
    print(f"  stats: {json.dumps(stats, ensure_ascii=False)[:200]}")

# 4. 测试 /admin/login 的客户端逻辑：会调用什么 API?
print("\n=== [4] check login page client code ===")
# 从登录页 HTML 提取 __NEXT_DATA__ 看 props
import re
nd_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>([^<]+)</script>', body)
if nd_match:
    next_data = json.loads(nd_match.group(1))
    print(f"  page: {next_data.get('page')}")
    print(f"  props keys: {list(next_data.get('props', {}).keys())}")
else:
    print("  no __NEXT_DATA__")

print("\n=== done ===")
