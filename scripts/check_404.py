"""检查 404 问题"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

# 1. 找到 nginx 配置
print("=== 查找 nginx 配置 ===")
stdin, stdout, stderr = client.exec_command(
    'find /etc/nginx -name "*.conf" -exec grep -l "admin" {} \\; 2>/dev/null; '
    'ls /etc/nginx/sites-enabled/ 2>/dev/null; '
    'ls /etc/nginx/conf.d/ 2>/dev/null',
    timeout=10
)
print(stdout.read().decode())

# 2. 查看 nginx admin 配置
print("=== nginx sites-enabled ===")
stdin, stdout, stderr = client.exec_command(
    'for f in /etc/nginx/sites-enabled/*; do echo "=== $f ==="; cat "$f"; done',
    timeout=10
)
print(stdout.read().decode())

# 3. 检查 PM2 进程是否真的在运行
print("=== PM2 详细状态 ===")
stdin, stdout, stderr = client.exec_command('pm2 show liftmark-admin 2>&1', timeout=10)
print(stdout.read().decode())

# 4. 测试从外部访问
print("=== 外部访问测试 ===")
stdin, stdout, stderr = client.exec_command(
    'curl -sL -o /dev/null -w "HTTP %{http_code} | size: %{size_download}\\n" http://47.100.239.29/admin/',
    timeout=10
)
print(stdout.read().decode())

# 5. 测试 CSS 加载
print("=== CSS 加载测试 ===")
stdin, stdout, stderr = client.exec_command(
    'curl -sI http://47.100.239.29/admin/_next/static/chunks/14jdlwq49gez2.css | head -5',
    timeout=10
)
print(stdout.read().decode())

# 6. 检查 PM2 最新日志
print("=== 最新 PM2 日志 ===")
stdin, stdout, stderr = client.exec_command('pm2 logs liftmark-admin --lines 5 --nostream 2>&1', timeout=10)
print(stdout.read().decode())

client.close()
