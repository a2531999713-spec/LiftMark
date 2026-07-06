"""
完整部署：上传整个 .next/standalone + .next/static 到服务器
standalone 输出保留了本地路径结构，需要找到实际的 server.js 位置
"""
import os
import shutil
import tempfile
import tarfile
import paramiko

HOST = '47.100.239.29'
PORT = 22
USER = 'deploy'
KEY = r'C:\Users\zhw\.ssh\id_ed25519'
LOCAL_NEXT = r'c:\Users\zhw\Documents\LiftMark\backend\.next'
LOCAL_PUBLIC = r'c:\Users\zhw\Documents\LiftMark\backend\public'
REMOTE_ADMIN = '/home/deploy/liftmark/admin-deploy'


def find_standalone_root(standalone_dir):
    """找到 standalone 中实际的应用根目录（包含 server.js 的目录）"""
    for root, dirs, files in os.walk(standalone_dir):
        if 'server.js' in files:
            return root
    return standalone_dir


def main():
    tmpdir = tempfile.mkdtemp()
    try:
        # 1. 准备部署包
        deploy_dir = os.path.join(tmpdir, 'deploy')
        os.makedirs(deploy_dir)

        # 找到 standalone 中实际的应用根目录
        standalone_src = os.path.join(LOCAL_NEXT, 'standalone')
        app_root = find_standalone_root(standalone_src)
        print(f"=== 应用根目录: {app_root} ===")

        # 将应用根目录的内容复制到部署根目录
        print("=== 复制应用文件 ===")
        for item in os.listdir(app_root):
            src = os.path.join(app_root, item)
            dst = os.path.join(deploy_dir, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)

        # static 放到 .next/static
        static_src = os.path.join(LOCAL_NEXT, 'static')
        static_dst = os.path.join(deploy_dir, '.next', 'static')
        print("=== 复制 static ===")
        os.makedirs(static_dst, exist_ok=True)
        shutil.copytree(static_src, static_dst, dirs_exist_ok=True)

        # 复制 public 目录
        if os.path.exists(LOCAL_PUBLIC):
            public_dst = os.path.join(deploy_dir, 'public')
            print("=== 复制 public ===")
            shutil.copytree(LOCAL_PUBLIC, public_dst, dirs_exist_ok=True)

        # 打包
        tar_path = os.path.join(tmpdir, 'deploy.tar.gz')
        with tarfile.open(tar_path, 'w:gz') as tar:
            tar.add(deploy_dir, arcname='.')

        size_mb = os.path.getsize(tar_path) / (1024 * 1024)
        print(f"压缩包大小: {size_mb:.2f} MB")

        # 2. 上传
        print("=== 上传到服务器 ===")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(HOST, PORT, USER, key_filename=KEY, allow_agent=False, look_for_keys=False)

        sftp = client.open_sftp()
        sftp.put(tar_path, '/tmp/deploy.tar.gz')
        sftp.close()

        # 3. 服务器端部署
        print("=== 服务器端部署 ===")
        cmd = f"""
cd /home/deploy/liftmark
pm2 stop liftmark-admin 2>/dev/null || true
rm -rf {REMOTE_ADMIN}
mkdir -p {REMOTE_ADMIN}
cd {REMOTE_ADMIN}
tar -xzf /tmp/deploy.tar.gz
rm /tmp/deploy.tar.gz
echo "=== 目录结构 ==="
ls -la
echo "---"
ls -la .next/static/chunks/ 2>/dev/null | head -10
echo "=== 启动服务 ==="
pm2 start liftmark-admin 2>/dev/null || pm2 restart liftmark-admin
sleep 3
echo "=== PM2 status ==="
pm2 list
echo "=== CSS files ==="
find {REMOTE_ADMIN}/.next/static -name "*.css" -exec ls -lh {{}} \\;
echo "=== HTML CSS ref ==="
curl -sL http://localhost:3001/admin/ | grep -oP 'href="[^"]*css[^"]*"' | head -5
"""
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode()
        err = stderr.read().decode()
        print(out)
        if err:
            print("STDERR:", err)

        client.close()

    finally:
        shutil.rmtree(tmpdir)
        print("=== 清理完成 ===")


if __name__ == '__main__':
    main()
