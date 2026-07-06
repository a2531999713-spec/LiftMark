"""检查服务器 CSS 加载情况"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

# 1. 检查 HTML 中引用的 CSS 文件
print("=== HTML 中引用的 CSS ===")
stdin, stdout, stderr = client.exec_command(
    'curl -sL http://localhost:3001/admin/ | grep -oP \'href="[^"]*css[^"]*"\' | head -10',
    timeout=10
)
print(stdout.read().decode())

# 2. 检查 CSS 文件实际大小
print("=== 服务器 CSS 文件 ===")
stdin, stdout, stderr = client.exec_command(
    'find /home/deploy/liftmark/admin-deploy/.next/static -name "*.css" -exec ls -lh {} \\;',
    timeout=10
)
print(stdout.read().decode())

# 3. 检查 CSS 是否包含 flex 工具类
print("=== CSS 是否包含 flex ===")
stdin, stdout, stderr = client.exec_command(
    'grep -c "flex" /home/deploy/liftmark/admin-deploy/.next/static/chunks/14jdlwq49gez2.css',
    timeout=10
)
print(stdout.read().decode())

# 4. 通过 nginx 访问
print("=== 通过 nginx 访问 CSS ===")
stdin, stdout, stderr = client.exec_command(
    'curl -sI http://localhost/admin/_next/static/chunks/14jdlwq49gez2.css | head -5',
    timeout=10
)
print(stdout.read().decode())

# 5. 检查 PM2 日志是否有错误
print("=== PM2 最近日志 ===")
stdin, stdout, stderr = client.exec_command(
    'pm2 logs liftmark-admin --lines 10 --nostream 2>&1',
    timeout=10
)
print(stdout.read().decode())

client.close()
