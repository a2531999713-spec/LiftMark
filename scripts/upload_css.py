"""
上传本地构建的 CSS 文件到服务器
"""
import os
import glob
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = os.path.expanduser('~/.ssh/id_ed25519')

# 本地构建产物路径
LOCAL_NEXT = r'c:\Users\zhw\Documents\LiftMark\backend\.next'
REMOTE_ADMIN = '/home/deploy/liftmark/admin-deploy'


def upload_build():
    """上传本地构建产物到服务器"""
    print("=== 连接服务器 ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)
        sftp = client.open_sftp()

        # 上传 static 目录
        local_static = os.path.join(LOCAL_NEXT, 'static')
        remote_static = f'{REMOTE_ADMIN}/.next/static'

        print(f"=== 上传 static 目录 ===")
        upload_dir(sftp, local_static, remote_static)

        # 上传 standalone 目录中的 server.js 等
        local_standalone = os.path.join(LOCAL_NEXT, 'standalone')
        if os.path.exists(local_standalone):
            print(f"=== 上传 standalone 目录 ===")
            upload_dir(sftp, local_standalone, REMOTE_ADMIN)

        sftp.close()

        # 重启服务
        print("=== 重启服务 ===")
        stdin, stdout, stderr = client.exec_command(
            'cd /home/deploy/liftmark && pm2 restart liftmark-admin',
            timeout=30
        )
        print(stdout.read().decode())
        print(stderr.read().decode())

        # 验证 CSS
        print("=== 验证 CSS 文件 ===")
        stdin, stdout, stderr = client.exec_command(
            f'find {REMOTE_ADMIN}/.next/static -name "*.css" -exec ls -lh {{}} \\;',
            timeout=10
        )
        print(stdout.read().decode())

        print("=== 完成 ===")

    finally:
        client.close()


def upload_dir(sftp, local_dir, remote_dir):
    """递归上传目录"""
    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f'{remote_dir}/{item}'

        if os.path.isdir(local_path):
            try:
                sftp.stat(remote_path)
            except FileNotFoundError:
                sftp.mkdir(remote_path)
            upload_dir(sftp, local_path, remote_path)
        else:
            size_mb = os.path.getsize(local_path) / (1024 * 1024)
            print(f"  上传: {item} ({size_mb:.2f} MB)")
            sftp.put(local_path, remote_path)


if __name__ == '__main__':
    upload_build()
