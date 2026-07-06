#!/bin/bash
# 部署本地构建产物到服务器
set -e

LOCAL_BUILD="c:/Users/zhw/Documents/LiftMark/backend/.next"
REMOTE_DEST="/home/deploy/liftmark/admin-deploy"
REMOTE_HOST="deploy@47.100.239.29"

echo "=== 打包本地构建产物 ==="
cd "c:/Users/zhw/Documents/LiftMark/backend"
tar -czf /tmp/admin-build.tar.gz .next

echo "=== 上传到服务器 ==="
scp /tmp/admin-build.tar.gz $REMOTE_HOST:/tmp/

echo "=== 服务器端部署 ==="
ssh $REMOTE_HOST << 'ENDSSH'
cd /home/deploy/liftmark

# 停止服务
pm2 stop liftmark-admin || true

# 备份旧版本
rm -rf admin-deploy-backup
mv admin-deploy admin-deploy-backup 2>/dev/null || true

# 解压新版本
mkdir -p admin-deploy
cd admin-deploy
tar -xzf /tmp/admin-build.tar.gz

# 复制 standalone 输出
cp -r .next/standalone/. ./
mkdir -p .next/static
cp -r .next/static/. .next/static/

# 清理
rm -rf .next/standalone
rm /tmp/admin-build.tar.gz

# 启动服务
pm2 start liftmark-admin || pm2 restart liftmark-admin

echo "=== 部署完成 ==="
ENDSSH

echo "=== 清理本地临时文件 ==="
rm -f /tmp/admin-build.tar.gz

echo "=== 部署成功 ==="
