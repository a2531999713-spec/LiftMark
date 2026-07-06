"""验证 Logo 和页面"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

# 1. 检查 Logo 文件
print("=== Logo 文件 ===")
stdin, stdout, stderr = client.exec_command('ls -lh /home/deploy/liftmark/admin-deploy/public/logo.png 2>/dev/null || echo "not found"', timeout=10)
print(stdout.read().decode())

# 2. 通过 nginx 访问 Logo
print("=== Logo HTTP 状态 ===")
stdin, stdout, stderr = client.exec_command('curl -sI http://47.100.239.29/admin/logo.png | head -5', timeout=10)
print(stdout.read().decode())

# 3. 验证登录页
print("=== 登录页 HTTP 状态 ===")
stdin, stdout, stderr = client.exec_command('curl -sI http://47.100.239.29/admin/login | head -5', timeout=10)
print(stdout.read().decode())

client.close()
