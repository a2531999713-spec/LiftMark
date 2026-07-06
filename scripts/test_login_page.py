"""模拟浏览器加载登录页：HTML + 所有 JS 资源"""
import json
import re
import urllib.request

BASE = "http://47.100.239.29"

# 1. 拉登录页 HTML
print("=== [1] GET /admin/login ===")
req = urllib.request.Request(f"{BASE}/admin/login", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as resp:
    body = resp.read().decode("utf-8", errors="replace")
    print(f"  HTTP {resp.status}, length={len(body)}")

# 2. 提取所有 script src
scripts = re.findall(r'<script[^>]*src="([^"]+)"', body)
print(f"\n=== [2] {len(scripts)} script tags ===")
for s in scripts:
    print(f"  {s}")

# 3. 提取所有 link href (CSS)
links = re.findall(r'<link[^>]*href="([^"]+)"', body)
print(f"\n=== [3] {len(links)} link tags ===")
for l in links:
    print(f"  {l}")

# 4. 测试每个资源是否能 200 加载
print(f"\n=== [4] test resources ===")
all_resources = [s for s in scripts if s.startswith('/admin/_next')] + \
                 [l for l in links if l.startswith('/admin/_next')]
for r in all_resources:
    url = BASE + r
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  [{resp.status}] {r[:80]}... ({resp.headers.get('content-type', '?')[:50]})")
    except urllib.error.HTTPError as e:
        print(f"  [{e.code}] {r[:80]}... - {e.reason}")
    except Exception as e:
        print(f"  [ERR] {r[:80]}... - {e}")

# 5. 看看登录页是否还有重定向问题
print(f"\n=== [5] fetch root / ===")
req = urllib.request.Request(f"{BASE}/")
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f"  HTTP {resp.status}, url: {resp.url}")
except urllib.error.HTTPError as e:
    print(f"  HTTP {e.code}, Location: {e.headers.get('Location')}")

print("\n=== done ===")
