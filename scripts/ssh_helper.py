"""
SSH 远程命令执行辅助脚本（密钥认证）
用法：python scripts/ssh_helper.py "命令"
"""
import os
import sys
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = os.path.expanduser('~/.ssh/id_ed25519')


def run(cmd: str, timeout: int = 120) -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, PORT, USER, timeout=15, key_filename=KEY, allow_agent=False, look_for_keys=False)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        code = stdout.channel.recv_exit_status()
        if out:
            sys.stdout.write(out)
        if err:
            sys.stderr.write(err)
        return code
    finally:
        client.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python ssh_helper.py "命令"', file=sys.stderr)
        sys.exit(2)
    cmd = sys.argv[1]
    sys.exit(run(cmd))
