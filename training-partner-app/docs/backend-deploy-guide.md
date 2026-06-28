# 后端部署指南

更新时间：2026-06-28

## 0. 服务器信息

| 项 | 值 |
|---|---|
| 公网 IP | `47.100.239.29` |
| SSH 用户 | `deploy` |
| 项目目录 | `/home/deploy/liftmark` |
| 后端目录 | `/home/deploy/liftmark/apps/liftmark-api` |
| API 公网地址 | `http://47.100.239.29/api` |
| Node.js 版本 | >= 22.13.0 |
| PM2 进程名 | `liftmark-api` |

## 1. 首次部署（全新服务器）

### 1.1 安装 Node.js

```bash
# 使用 nvm 安装 Node.js 22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v  # 应显示 v22.x.x
```

### 1.2 安装 PM2

```bash
npm install -g pm2
pm2 startup  # 设置开机自启
```

### 1.3 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# 启动并设置开机自启
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 1.4 创建数据库和用户

```bash
sudo -u postgres psql
```

在 psql 中执行：

```sql
CREATE USER liftmark_user WITH PASSWORD '你的密码';
CREATE DATABASE liftmark_prod OWNER liftmark_user;
GRANT ALL PRIVILEGES ON DATABASE liftmark_prod TO liftmark_user;
\q
```

### 1.5 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 1.6 配置 Nginx 反向代理

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/liftmark
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name 47.100.239.29;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10m;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/liftmark /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 2. 部署代码（日常更新）

### 2.1 拉取最新代码

```bash
cd /home/deploy/liftmark
git pull origin master
```

### 2.2 安装依赖

```bash
cd apps/liftmark-api
npm install
```

### 2.3 配置环境变量

复制并编辑环境变量：

```bash
cp .env.example .env
nano .env
```

必须修改的配置：

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000

# 数据库连接（修改密码为你设置的密码）
DATABASE_URL=postgresql://liftmark_user:你的密码@127.0.0.1:5432/liftmark_prod

# JWT 密钥（生成随机字符串）
JWT_SECRET=随机字符串1
JWT_REFRESH_SECRET=随机字符串2

# 短信服务（测试用 mock，生产用 aliyun）
SMS_PROVIDER=mock

# 管理员账号（可选）
ADMIN_PHONE=你的手机号
ADMIN_EMAIL=你的邮箱
ADMIN_INITIAL_PASSWORD=管理员密码
```

生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 构建 TypeScript

```bash
npm run build
```

### 2.5 执行数据库迁移

```bash
npm run db:migrate
```

### 2.6 初始化种子数据（首次）

```bash
npm run db:seed
```

### 2.7 重启服务

```bash
# 如果服务已在运行
pm2 restart liftmark-api

# 如果是首次启动
pm2 start ecosystem.config.js
pm2 save
```

### 2.8 验证部署

```bash
# 健康检查
curl http://127.0.0.1:3000/health

# 公网健康检查
curl http://47.100.239.29/api/health

# 查看日志
pm2 logs liftmark-api
```

## 3. 一键部署脚本

将以下内容保存为 `deploy.sh`，放在项目根目录：

```bash
#!/bin/bash
set -e

echo "=== LiftMark 后端部署 ==="

# 进入后端目录
cd /home/deploy/liftmark/apps/liftmark-api

# 拉取最新代码
echo "1/6 拉取最新代码..."
cd /home/deploy/liftmark
git pull origin master
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

# 验证
echo "6/6 验证部署..."
sleep 2
curl -s http://127.0.0.1:3000/health | head -c 200
echo ""
echo "=== 部署完成 ==="
```

使用方式：

```bash
chmod +x deploy.sh
./deploy.sh
```

## 4. 常用运维命令

### 4.1 查看状态

```bash
pm2 status                    # 查看进程状态
pm2 logs liftmark-api         # 查看实时日志
pm2 logs liftmark-api --err    # 查看错误日志
```

### 4.2 重启服务

```bash
pm2 restart liftmark-api      # 重启
pm2 stop liftmark-api         # 停止
pm2 start liftmark-api        # 启动
```

### 4.3 查看数据库

```bash
sudo -u postgres psql -d liftmark_prod
```

常用 SQL：

```sql
-- 查看所有表
\dt

-- 查看用户表
SELECT id, phone, email, liftmark_id, nickname FROM users LIMIT 10;

-- 查看迁移版本
SELECT * FROM schema_migrations ORDER BY version DESC;

-- 退出
\q
```

### 4.4 手动执行迁移

```bash
cd /home/deploy/liftmark/apps/liftmark-api
npm run db:migrate
```

### 4.5 查看 Nginx 状态

```bash
sudo nginx -t                 # 测试配置
sudo systemctl reload nginx   # 重载配置
sudo systemctl status nginx   # 查看状态
```

## 5. 故障排查

### 5.1 服务无法启动

```bash
# 查看错误日志
pm2 logs liftmark-api --err --lines 50

# 常见原因：环境变量缺失
# 检查 .env 文件是否存在
cat .env
```

### 5.2 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 测试连接
psql -h 127.0.0.1 -U liftmark_user -d liftmark_prod
```

### 5.3 Nginx 502 错误

```bash
# 检查后端是否运行
pm2 status

# 检查端口是否监听
ss -tlnp | grep 3000

# 检查 Nginx 配置
sudo nginx -t
```

### 5.4 迁移失败

```bash
# 查看当前迁移版本
sudo -u postgres psql -d liftmark_prod -c "SELECT * FROM schema_migrations ORDER BY version DESC;"

# 手动执行迁移
cd /home/deploy/liftmark/apps/liftmark-api
npx tsx src/db/migrate.ts
```

## 6. 安全建议

### 6.1 生产环境必须修改

- [ ] `.env` 中的 `JWT_SECRET` 和 `JWT_REFRESH_SECRET` 使用随机强密钥
- [ ] `.env` 中的 `DATABASE_URL` 使用强密码
- [ ] `SMS_PROVIDER` 改为 `aliyun` 并配置真实的阿里云密钥
- [ ] 配置 HTTPS（使用 Let's Encrypt）

### 6.2 配置 HTTPS（推荐）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d 47.100.239.29

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

### 6.3 防火墙

```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 7. 客户端配置

App 端 API 地址配置在 `src/config/api.ts`：

```typescript
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://47.100.239.29/api';
```

如果更换服务器地址，修改此处并重新打包 APK。

## 8. 部署检查清单

每次部署后确认：

- [ ] `curl http://47.100.239.29/api/health` 返回 `{"ok":true}`
- [ ] `pm2 status` 显示 `liftmark-api` 为 `online`
- [ ] App 端可以正常登录
- [ ] `pm2 logs liftmark-api --lines 20` 无报错
