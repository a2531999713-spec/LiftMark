"""
部署本地构建产物到服务器
"""
import os
import tarfile
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = os.path.expanduser('~/.ssh/id_ed25519')
LOCAL_BUILD = r'c:\Users\zhw\Documents\LiftMark\backend\.next'
REMOTE_DEST = '/home/deploy/liftmark/admin-deploy'


def create_tarball():
    """创建本地构建产物的压缩包"""
    import tempfile
    tar_path = os.path.join(tempfile.gettempdir(), 'admin-build.tar.gz')
    print(f"=== 打包本地构建产物: {LOCAL_BUILD} ===")

    with tarfile.open(tar_path, 'w:gz') as tar:
        tar.add(LOCAL_BUILD, arcname='.next')

    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"压缩包大小: {size_mb:.2f} MB")
    return tar_path


def upload_and_deploy(tar_path):
    """上传并部署到服务器"""
    print("=== 连接服务器 ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

        # 上传压缩包
        print("=== 上传构建产物 ===")
        sftp = client.open_sftp()
        sftp.put(tar_path, '/tmp/admin-build.tar.gz')
        sftp.close()

        # 执行部署命令
        print("=== 服务器端部署 ===")
        commands = [
            'cd /home/deploy/liftmark',
            'pm2 stop liftmark-admin || true',
            'rm -rf admin-deploy-backup',
            f'mv {REMOTE_DEST} admin-deploy-backup 2>/dev/null || true',
            f'mkdir -p {REMOTE_DEST}',
            f'cd {REMOTE_DEST}',
            'tar -xzf /tmp/admin-build.tar.gz',
            'cp -r .next/standalone/. ./',
            'mkdir -p .next/static',
            'cp -r .next/static/. .next/static/',
            'rm -rf .next/standalone',
            'rm /tmp/admin-build.tar.gz',
            'pm2 start liftmark-admin || pm2 restart liftmark-admin',
        ]

        cmd = ' && '.join(commands)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        code = stdout.channel.recv_exit_status()

        if out:
            print(out)
        if err:
            print("STDERR:", err)

        if code != 0:
            print(f"部署失败，退出码: {code}")
            return False

        print("=== 部署成功 ===")
        return True

    finally:
        client.close()


def cleanup(tar_path):
    """清理本地临时文件"""
    if os.path.exists(tar_path):
        os.remove(tar_path)
        print(f"=== 已清理临时文件: {tar_path} ===")


if __name__ == '__main__':
    tar_path = create_tarball()
    success = upload_and_deploy(tar_path)
    cleanup(tar_path)

    if success:
        print("\n✓ 部署完成！请访问 http://47.100.239.29/admin/")
    else:
        print("\n✗ 部署失败，请检查错误信息")
