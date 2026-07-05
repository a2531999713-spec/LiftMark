"""
SCP 上传文件/目录到服务器
用法：
  python scripts\scp_helper.py upload <本地路径> <远程路径>
  python scripts\scp_helper.py download <远程路径> <本地路径>
"""
import os
import sys
import stat
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = os.path.expanduser('~/.ssh/id_ed25519')


def connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, PORT, USER, timeout=15, key_filename=KEY, allow_agent=False, look_for_keys=False)
    return client


def mkdir_p(sftp, remote_dir: str):
    if remote_dir in ('/', '.', ''):
        return
    try:
        sftp.stat(remote_dir)
        return
    except FileNotFoundError:
        pass
    parent = os.path.dirname(remote_dir)
    if parent and parent != remote_dir:
        mkdir_p(sftp, parent)
    try:
        sftp.mkdir(remote_dir)
    except OSError:
        pass


def upload_dir(sftp, local_dir: str, remote_dir: str):
    mkdir_p(sftp, remote_dir)
    for name in os.listdir(local_dir):
        local_path = os.path.join(local_dir, name)
        remote_path = remote_dir.rstrip('/') + '/' + name
        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            print(f'  uploaded: {remote_path}')


def upload(local: str, remote: str):
    client = connect()
    try:
        sftp = client.open_sftp()
        if os.path.isdir(local):
            upload_dir(sftp, local, remote)
        else:
            mkdir_p(sftp, os.path.dirname(remote) or '.')
            sftp.put(local, remote)
            print(f'  uploaded: {remote}')
        sftp.close()
    finally:
        client.close()


def download(local: str, remote: str):
    client = connect()
    try:
        sftp = client.open_sftp()
        sftp.get(remote, local)
        print(f'  downloaded: {remote} -> {local}')
        sftp.close()
    finally:
        client.close()


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('用法: python scp_helper.py <upload|download> <本地> <远程>', file=sys.stderr)
        sys.exit(2)
    action = sys.argv[1]
    local = sys.argv[2]
    remote = sys.argv[3]
    if action == 'upload':
        upload(local, remote)
    elif action == 'download':
        download(local, remote)
    else:
        print(f'未知操作: {action}', file=sys.stderr)
        sys.exit(2)
