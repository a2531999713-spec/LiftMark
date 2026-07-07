#!/bin/bash
# 重启 deploy 用户的 liftmark-api 进程
# 注意：不要用 sudo 启动 API！
set -e

echo "========================================="
echo "  重启 API 服务（deploy用户）"
echo "========================================="

echo ""
echo "步骤1: 停止当前API进程..."
pm2 stop liftmark-api 2>/dev/null || echo "API未运行"

echo ""
echo "步骤2: 重新构建（如需要）..."
cd /home/deploy/liftmark/apps/liftmark-api
if [ -f "src/server.ts" ]; then
  echo "检测到源码，执行构建..."
  npm run build 2>&1 | tail -10
fi

echo ""
echo "步骤3: 启动API服务..."
pm2 restart liftmark-api || pm2 start ecosystem.config.js

echo ""
echo "步骤4: 等待启动..."
sleep 5

echo ""
echo "步骤5: 检查状态..."
pm2 list | grep liftmark-api

echo ""
echo "步骤6: 检查端口..."
ss -tlnp 2>/dev/null | grep ':3000' || echo "⚠ 端口3000未监听"

echo ""
echo "步骤7: 测试API..."
sleep 2
curl -s http://127.0.0.1:3000/api/health || echo "⚠ API测试失败"

echo ""
echo "步骤8: 保存PM2配置..."
pm2 save --force

echo ""
echo "========================================="
echo "  重启完成"
echo "========================================="
echo ""
pm2 list
