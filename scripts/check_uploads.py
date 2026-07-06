"""检查上传目录配置"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

# 检查上传目录
print("=== 上传目录 ===")
stdin, stdout, stderr = client.exec_command('ls -la /home/deploy/liftmark/uploads/ 2>/dev/null && echo "---" && ls -la /home/deploy/liftmark/uploads/avatars/ 2>/dev/null || echo "目录不存在"', timeout=10)
print(stdout.read().decode())

# 检查 nginx 配置
print("=== nginx 配置 ===")
stdin, stdout, stderr = client.exec_command('grep -r "uploads" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || echo "未找到 uploads 相关配置"', timeout=10)
print(stdout.read().decode())

# 检查 API 直接访问
print("=== 直接访问 API 上传目录 ===")
stdin, stdout, stderr = client.exec_command('curl -sI http://localhost:3000/uploads/ 2>&1 | head -5', timeout=10)
print(stdout.read().decode())

# 检查 nginx 访问
print("=== 通过 nginx 访问 ===")
stdin, stdout, stderr = client.exec_command('curl -sI http://47.100.239.29/uploads/ 2>&1 | head -5', timeout=10)
print(stdout.read().decode())

client.close()
