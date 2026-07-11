# 后端部署指南

更新时间：2026-07-06

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

    client_max_body_size 5m;

    # 静态文件服务 - 头像等上传文件
    location /uploads/ {
        alias /home/deploy/liftmark/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/liftmark /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 1.7 创建上传目录

```bash
sudo mkdir -p /home/deploy/liftmark/uploads/avatars
sudo chown -R deploy:deploy /home/deploy/liftmark/uploads
sudo chmod -R 755 /home/deploy/liftmark/uploads
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

-- 查看小组表
SELECT id, name, owner_user_id FROM groups LIMIT 10;

-- 查看小组成员表
SELECT gm.id, gm.user_id, gm.role, u.nickname 
FROM group_members gm 
JOIN users u ON gm.user_id = u.id 
LIMIT 10;

-- 查看待确认训练数据
SELECT id, uploader_user_id, target_user_id, status 
FROM pending_training_data 
LIMIT 10;

-- 查看邀请码
SELECT id, code, max_uses, use_count, expires_at 
FROM group_invitations 
LIMIT 10;

-- 查看迁移版本
SELECT * FROM schema_migrations ORDER BY applied_at DESC;

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

### 5.5 同步实体表扩展（2026-07-07）

本次版本新增 `plan_phases`、`recovery_logs`、`progression_suggestions` 三张同步表，对应移动端新增的同步实体类型。升级步骤：

```bash
cd /home/deploy/liftmark/apps/liftmark-api
git pull origin main
npm install            # 如有依赖变更
npx tsx src/db/migrate.ts   # 执行 009_extend_sync_entity_tables 迁移
pm2 restart liftmark-api --update-env
pm2 save --force
```

验证同步表创建成功：

```bash
sudo -u postgres psql -d liftmark_prod -c "\dt plan_phases"
sudo -u postgres psql -d liftmark_prod -c "\dt recovery_logs"
sudo -u postgres psql -d liftmark_prod -c "\dt progression_suggestions"
```

三张表应包含 `id`、`user_id`、`client_id`、`payload`、`sync_version`、`created_at`、`updated_at` 等同步标准字段。

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

### 6.4 运维脚本中的敏感信息

`scripts/` 目录下的运维脚本需要 sudo 密码和测试用的管理员账号。
**这些敏感信息不得写入 Git 仓库**。

已提供示例文件，使用前复制并填写真实值：

```bash
cp scripts/.env.example scripts/.env
nano scripts/.env
```

`scripts/.env` 已被加入 `.gitignore`，不会提交。
各脚本启动时会自动读取该文件，缺失时会提示错误并退出。

如果历史提交中已泄露过 sudo 密码或管理员密码，建议：

1. 立即修改服务器 sudo 密码和 root 密码
2. 修改管理员手机号/密码（或重新生成管理员账号）
3. 轮换 `.env` 中的 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`
4. 检查服务器日志是否有异常登录

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

---

## 9. 管理员控制台 (Admin Console) 部署

管理员后台是一个独立的 Next.js 16 standalone 应用，部署在 3001 端口，通过 nginx `/admin/` 反向代理对外提供服务。

### 9.1 概览

| 项 | 值 |
|---|---|
| 公网访问地址 | `http://47.100.239.29/admin/` |
| 内部监听地址 | `http://127.0.0.1:3001` |
| 部署目录 | `/home/deploy/liftmark/admin-deploy` |
| 源代码目录 | `/home/deploy/liftmark/management-console` |
| PM2 进程名 | `liftmark-admin` |
| 框架 | Next.js 16.2.6 (standalone) + React 19 |
| basePath | `/admin` |

### 9.2 管理员账号

首次部署时通过 `npm run db:seed` 创建超级管理员，默认凭据（请尽快修改）：

- 手机号 / 邮箱：`17606108291` / `2531999713@qq.com`
- 密码：`lianke969`

### 9.3 首次部署

#### 9.3.1 在服务器上构建 standalone

```bash
cd /home/deploy/liftmark
git pull origin master            # 确保在 master 分支且代码最新

cd backend
npm install --no-audit --no-fund  # 安装依赖（含 devDependencies 用于构建）
npm run build                     # 生成 .next/standalone/
```

构建产物：`management-console/.next/standalone/server.js` + `management-console/.next/static/`

#### 9.3.2 准备运行目录

```bash
DEST=/home/deploy/liftmark/admin-deploy
SRC=/home/deploy/liftmark/management-console

rm -rf "$DEST"
mkdir -p "$DEST/.next/static" "$DEST/public"

# 复制 standalone（含 server.js、package.json、必要的 node_modules）
cp -r "$SRC/.next/standalone/." "$DEST/"
# 复制静态资源
cp -r "$SRC/.next/static/." "$DEST/.next/static/"
# 复制 public 目录（图标、favicon 等）
cp -r "$SRC/public/." "$DEST/public/"
```

#### 9.3.3 配置 PM2

在 `$DEST/ecosystem.config.cjs` 写入：

```js
module.exports = {
  apps: [{
    name: 'liftmark-admin',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOSTNAME: '127.0.0.1',
    },
    error_file: '/home/deploy/liftmark/logs/liftmark-admin.err.log',
    out_file: '/home/deploy/liftmark/logs/liftmark-admin.out.log',
    time: true,
  }]
}
```

启动并保存：

```bash
mkdir -p /home/deploy/liftmark/logs
cd "$DEST"
pm2 start ecosystem.config.cjs
pm2 save                              # 持久化进程列表
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

#### 9.3.4 配置 nginx 反向代理

编辑 `/etc/nginx/sites-enabled/liftmark`，新增 `/admin/` location：

```nginx
# 管理员控制台 - Next.js standalone @ port 3001
location /admin/ {
    proxy_pass http://127.0.0.1:3001/admin/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
}

# /admin -> /admin/ (trailing slash)
location = /admin {
    return 308 /admin/;
}

# 根路径 - 重定向到 /admin/
location = / {
    return 302 /admin/;
}
```

应用配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 9.3.5 验证

```bash
# 1. 进程是否在线
pm2 list | grep liftmark-admin

# 2. 本地端口是否监听
curl -s -o /dev/null -w "HTTP:%{http_code}\n" http://127.0.0.1:3001/admin/login

# 3. 通过 nginx 是否可访问
curl -s -o /dev/null -w "HTTP:%{http_code}\n" http://127.0.0.1/admin/login

# 4. 公网是否可访问
curl -s -o /dev/null -w "HTTP:%{http_code}\n" http://47.100.239.29/admin/login

# 5. API 联通性（管理员登录）
curl -s -X POST http://47.100.239.29/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"17606108291","password":"你的密码"}'
```

预期：所有 HTTP 状态码为 200，登录返回 `accessToken` 与 `refreshToken`。

### 9.4 日常更新（重新部署）

源代码改了之后，重新构建并替换部署目录：

```bash
cd /home/deploy/liftmark
git pull origin master

cd backend
npm install --no-audit --no-fund
npm run build

DEST=/home/deploy/liftmark/admin-deploy
SRC=/home/deploy/liftmark/management-console

# 备份旧目录（可选）
mv "$DEST" "${DEST}.bak.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
mkdir -p "$DEST/.next/static" "$DEST/public"
cp -r "$SRC/.next/standalone/." "$DEST/"
cp -r "$SRC/.next/static/." "$DEST/.next/static/"
cp -r "$SRC/public/." "$DEST/public/"
cp "${DEST}.bak."*/ecosystem.config.cjs "$DEST/" 2>/dev/null \
  || cat > "$DEST/ecosystem.config.cjs" <<'EOF'
module.exports = {
  apps: [{
    name: 'liftmark-admin', script: 'server.js', cwd: __dirname,
    instances: 1, exec_mode: 'fork', max_memory_restart: '512M',
    env: { NODE_ENV: 'production', PORT: 3001, HOSTNAME: '127.0.0.1' },
    error_file: '/home/deploy/liftmark/logs/liftmark-admin.err.log',
    out_file: '/home/deploy/liftmark/logs/liftmark-admin.out.log',
    time: true,
  }]
}
EOF

pm2 restart liftmark-admin --update-env
pm2 save
```

### 9.5 与 liftmark-api 协同部署

`management-console/` 和 `apps/liftmark-api/` 是两个独立服务：

| 服务 | 端口 | PM2 进程 | 跑在 |
|---|---|---|---|
| `liftmark-api` | 3000 | root 的 PM2 | `/home/deploy/liftmark/apps/liftmark-api` |
| `liftmark-admin` | 3001 | deploy 的 PM2 | `/home/deploy/liftmark/admin-deploy` |

API 路由前缀：`/api/admin/*`（由 `liftmark-api` 提供）
页面路由前缀：`/admin/*`（由 `liftmark-admin` 提供）

新增 / 修改管理后台 API 后只需重启 `liftmark-api`；新增 / 修改管理后台页面只需重建并重启 `liftmark-admin`。

### 9.6 故障排查

#### 9.6.1 访问 `/admin/` 返回 502

```bash
pm2 logs liftmark-admin --err --lines 30
ss -tlnp | grep 3001   # 端口是否在监听
```

常见原因：
- `admin-deploy/server.js` 不存在或路径不对（`find admin-deploy -name server.js`）
- `admin-deploy/.next/static/` 缺失，导致页面加载时找不到资源
- `admin-deploy/node_modules/` 缺失（应包含 `next`、`react`、`react-dom` 等）

#### 9.6.2 登录页能打开但登录 500 / 401

```bash
# 检查 API 是否正常
curl -s -X POST http://127.0.0.1:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"17606108291","password":"你的密码"}'
```

- 返回 401：账号或密码错误
- 返回 500：API 日志（`pm2 logs liftmark-api`）有详细错误

#### 9.6.3 静态资源 404

nginx 没把 `/admin/_next/static/*` 转发到 3001。检查 nginx 配置中 `location /admin/` 块是否完整。

#### 9.6.4 切换分支或拉取代码后页面没更新

代码更新了但 standalone 没重新构建。务必执行 `npm run build` 然后复制 `standalone/` 到 `admin-deploy/`，再 `pm2 restart liftmark-admin`。

---

## 10. 数据库定时备份

PostgreSQL 数据每天凌晨 3 点自动备份，保留最近 14 天。

### 10.1 备份脚本

脚本位置：`/home/deploy/liftmark/scripts/backup_database.sh`

主要行为：

- 读取 `apps/liftmark-api/.env` 中的 `DATABASE_URL`。
- 使用 `pg_dump` 导出数据库为 SQL。
- `gzip` 压缩后保存到 `/home/deploy/liftmark/backups/`。
- 删除 14 天前的旧备份。
- 日志输出到 `/home/deploy/liftmark/logs/backup_YYYYMMDD_HHMMSS.log`。

### 10.2 首次安装

```bash
# 1. 确保脚本已上传并赋予执行权限
chmod +x /home/deploy/liftmark/scripts/backup_database.sh

# 2. 创建备份和日志目录
mkdir -p /home/deploy/liftmark/backups /home/deploy/liftmark/logs

# 3. 确认服务器已安装 postgresql-client
which pg_dump   # 应输出 /usr/bin/pg_dump
```

### 10.3 配置 cron

```bash
crontab -e
```

添加一行：

```cron
0 3 * * * /home/deploy/liftmark/scripts/backup_database.sh
```

查看已配置的定时任务：

```bash
crontab -l
```

### 10.4 手动执行备份

```bash
/home/deploy/liftmark/scripts/backup_database.sh
```

执行成功后可在 `/home/deploy/liftmark/backups/` 看到类似 `liftmark_20260706_092249.sql.gz` 的文件。

### 10.5 从备份恢复

**注意：恢复会覆盖当前数据库，请先在测试环境验证或备份当前数据。**

```bash
# 1. 找到要恢复的备份文件
BACKUP=/home/deploy/liftmark/backups/liftmark_YYYYMMDD_HHMMSS.sql.gz

# 2. 停止 API 服务，避免写入
pm2 stop liftmark-api

# 3. 解压并恢复
gunzip -c "$BACKUP" | psql "$(grep '^DATABASE_URL=' /home/deploy/liftmark/apps/liftmark-api/.env | cut -d '=' -f2- | tr -d '\"')"

# 4. 重新启动服务
pm2 start liftmark-api
```

### 10.6 故障排查

| 现象 | 排查 |
|---|---|
| 备份文件没有生成 | 检查日志 `/home/deploy/liftmark/logs/backup_*.log` 是否有 `DATABASE_URL` 读取错误或 `pg_dump` 连接失败。 |
| `pg_dump: command not found` | 安装 `postgresql-client`：`sudo apt install -y postgresql-client`。 |
| cron 未执行 | 检查 `crontab -l` 是否包含条目，确认 cron 服务运行：`sudo systemctl status cron`。 |
| 备份文件过大 | 数据库增长后建议使用 `pg_dump --format=custom` 结合 `pg_restore`，或增加备份保留策略。 |
