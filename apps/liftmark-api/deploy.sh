#!/bin/bash
set -e

echo "=== LiftMark 后端部署 ==="
echo "时间: $(date)"

# 进入项目根目录
cd /home/deploy/liftmark

# 拉取最新代码
echo "1/6 拉取最新代码..."
git pull origin master

# 进入后端目录
cd apps/liftmark-api

# 安装依赖
echo "2/6 安装依赖..."
npm install

# 构建
echo "3/6 构建 TypeScript..."
npm run build

# 数据库迁移
echo "4/6 执行数据库迁移..."
npm run db:migrate

# 重启服务
echo "5/6 重启服务..."
pm2 restart liftmark-api || pm2 start ecosystem.config.js
pm2 save

# 验证
echo "6/6 验证部署..."
sleep 2
HEALTH=$(curl -s http://127.0.0.1:3000/health)
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "✅ 健康检查通过: $HEALTH"
else
  echo "❌ 健康检查失败: $HEALTH"
  exit 1
fi

echo ""
echo "=== 部署完成 ==="
echo "API 地址: http://47.100.239.29/api"
echo "查看日志: pm2 logs liftmark-api"
