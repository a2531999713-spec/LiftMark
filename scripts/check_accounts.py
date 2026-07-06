"""检查 176 和 3716 账号关联数据"""
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

query = """
cd /home/deploy/liftmark/apps/liftmark-api && npx ts-node -e "
import { db } from './src/db/connection';
async function main() {
  const allUsers = await db('users').select('id','phone','nickname','liftmark_id','role','status');
  console.log('=== 所有用户 ===');
  console.log(JSON.stringify(allUsers, null, 2));

  const allGroups = await db('groups')
    .leftJoin('users as owner', 'groups.owner_user_id', 'owner.id')
    .select('groups.*', 'owner.nickname as owner_nickname', 'owner.phone as owner_phone');
  console.log('=== 所有小组 ===');
  console.log(JSON.stringify(allGroups, null, 2));

  const allMembers = await db('group_members')
    .leftJoin('users', 'group_members.user_id', 'users.id')
    .leftJoin('groups', 'group_members.group_id', 'groups.id')
    .select('group_members.*', 'users.nickname as user_nickname', 'users.phone as user_phone', 'groups.name as group_name');
  console.log('=== 所有小组成员 ===');
  console.log(JSON.stringify(allMembers, null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
"
"""

stdin, stdout, stderr = client.exec_command(query, timeout=60)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print("STDERR:", err)

client.close()
