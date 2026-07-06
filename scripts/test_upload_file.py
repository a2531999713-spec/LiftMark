"""测试具体头像文件是否能访问"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

filename = 'usr_35c96ce5f49045448bae4ec1dd5340a6_1783094700253.jpg'

print("=== 通过 nginx 访问具体头像文件 ===")
stdin, stdout, stderr = client.exec_command(f'curl -sI http://47.100.239.29/uploads/avatars/{filename}', timeout=10)
print(stdout.read().decode())

print("=== 直接访问 API 具体头像文件 ===")
stdin, stdout, stderr = client.exec_command(f'curl -sI http://localhost:3000/uploads/avatars/{filename}', timeout=10)
print(stdout.read().decode())

client.close()
