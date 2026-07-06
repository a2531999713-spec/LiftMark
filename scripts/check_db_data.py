"""检查数据库中关键表的数据量"""
import os
from pathlib import Path
import paramiko

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
if not ADMIN_PHONE:
    raise SystemExit("请在 scripts/.env 中设置 ADMIN_PHONE，参考 scripts/.env.example")
HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

# 检查各表数据量
tables = [
    'training_plans', 'exercises', 'training_rooms',
    'users', 'groups', 'group_members', 'memberships'
]

print("=== 数据库表数据量 ===")
for table in tables:
    stdin, stdout, stderr = client.exec_command(
        f"cd /home/deploy/liftmark/apps/liftmark-api && npx ts-node -e \"import {{ db }} from './src/db/connection'; db('{table}').count('* as c').then(r => console.log(r[0].c)).finally(() => process.exit(0))\" 2>&1",
        timeout=30
    )
    print(f"{table}: {stdout.read().decode().strip()}")

# 检查 176 和 3716 账号信息
print("\n=== 176 账号 ===")
stdin, stdout, stderr = client.exec_command(
    f"cd /home/deploy/liftmark/apps/liftmark-api && npx ts-node -e \"import {{ db }} from './src/db/connection'; db('users').where('phone', 'like', '%{ADMIN_PHONE}%').select('id','phone','nickname','liftmark_id').then(r => console.log(JSON.stringify(r,null,2))).finally(()=>process.exit(0))\"",
    timeout=30
)
print(stdout.read().decode())

print("\n=== 3716 账号 ===")
stdin, stdout, stderr = client.exec_command(
    "cd /home/deploy/liftmark/apps/liftmark-api && npx ts-node -e \"import {{ db }} from './src/db/connection'; db('users').where('nickname', 'like', '%3716%').select('id','phone','nickname','liftmark_id').then(r => console.log(JSON.stringify(r,null,2))).finally(()=>process.exit(0))\"",
    timeout=30
)
print(stdout.read().decode())

client.close()
