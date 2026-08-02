# LiftMark 服务器调试、重启与功能验证手册

更新时间：2026-08-02
适用项目：练刻 LiftMark
适用环境：当前阿里云生产服务器

## 1. 服务器结构速查

| 项目 | 当前值 |
|---|---|
| 公网地址 | `47.100.239.29` |
| SSH 用户 | `deploy` |
| 项目目录 | `/home/deploy/liftmark` |
| API 目录 | `/home/deploy/liftmark/apps/liftmark-api` |
| 管理后台源码 | `/home/deploy/liftmark/management-console` |
| 管理后台运行目录 | `/home/deploy/liftmark/admin-deploy` |
| API 进程 | `liftmark-api`，监听 `127.0.0.1:3000` |
| 管理后台进程 | `liftmark-admin`，监听 `127.0.0.1:3001` |
| 公网入口 | Nginx，监听 80/443 |
| API 公网地址 | `http://47.100.239.29/api` |
| 管理后台 | `http://47.100.239.29/admin/` |

请求链路：

```text
手机 App / 浏览器
  → Nginx
  → /api/*   → liftmark-api:3000 → PostgreSQL
  → /admin/* → liftmark-admin:3001
```

## 2. 首要安全规则

1. 不要在聊天、截图或日志中显示 `.env`、数据库连接串、JWT 密钥、短信密钥或 SSH 私钥。
2. 不要执行无条件 `DELETE`、`TRUNCATE`、`DROP` 或批量修改 `owner_user_id`。
3. 不要删除、迁移或改写 176 主账号的训练、计划、小组和历史数据。
4. 不要把 176 与 188 的数据互相迁移。
5. 数据库迁移、seed、数据修正和恢复备份之前，必须先生成并确认备份。
6. 普通排障先做只读检查；只有确认故障点后才重启对应服务。
7. API 使用 `deploy` 用户的 PM2，不要混用 `sudo pm2` 或 root 的另一套 PM2 进程表。
8. 服务器仓库有未提交修改时，不要直接 pull、切分支或覆盖文件，先查明来源。

受保护账号：

```text
176 主账号：usr_35c96ce5f49045448bae4ec1dd5340a6
188 测试账号：usr_90fe5d00deaf431c8a15e140b056ff8e
```

## 3. 从 Windows PowerShell 登录服务器

不要把私钥放进 Git。将下面的路径换成私钥实际位置：

```powershell
ssh -i "<SSH_KEY_PATH>" deploy@47.100.239.29
```

首次连接会询问主机指纹。应先核对服务器 IP，再输入 `yes`。

登录后确认身份和目录：

```bash
whoami
hostname
cd /home/deploy/liftmark
pwd
git status --short
git branch --show-current
git log --oneline -5
```

预期：用户为 `deploy`，生产源码通常位于 `master`，计划部署前工作区应为空。

## 4. 60 秒快速健康检查

依次执行：

```bash
pm2 status
ss -tlnp | grep -E ':3000|:3001'
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/migration-health
curl -sS -o /dev/null -w 'admin=%{http_code}\n' http://127.0.0.1:3001/admin/login
curl -sS -o /dev/null -w 'public_api=%{http_code}\n' http://47.100.239.29/api/health
curl -sS -o /dev/null -w 'public_admin=%{http_code}\n' http://47.100.239.29/admin/login
```

正常结果：

- `liftmark-api` 与 `liftmark-admin` 都是 `online`。
- 3000 和 3001 都在监听。
- `/api/health` 返回 `ok: true`。
- `/api/migration-health` 返回 HTTP 200、`schema: ready`。
- 管理后台登录页返回 200。

若本机地址正常但公网失败，优先检查 Nginx、防火墙和安全组，不要反复重启 API。

## 5. PM2 常用命令

查看全部服务：

```bash
pm2 status
pm2 describe liftmark-api
pm2 describe liftmark-admin
```

查看实时日志：

```bash
pm2 logs liftmark-api --lines 100
pm2 logs liftmark-admin --lines 100
```

只看错误日志：

```bash
pm2 logs liftmark-api --err --lines 100
pm2 logs liftmark-admin --err --lines 100
```

结束实时日志使用 `Ctrl+C`，不会停止服务。

## 6. 正确重启服务

### 6.1 只重载 API

适用于 API 已重新构建、配置未改变的情况：

```bash
cd /home/deploy/liftmark
pm2 reload apps/liftmark-api/ecosystem.config.js --only liftmark-api
pm2 status liftmark-api
curl -fsS http://127.0.0.1:3000/api/health
```

若修改了 `.env` 或 ecosystem 环境变量：

```bash
pm2 reload apps/liftmark-api/ecosystem.config.js --only liftmark-api --update-env
```

### 6.2 只重启管理后台

```bash
pm2 restart liftmark-admin --update-env
pm2 status liftmark-admin
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3001/admin/login
```

### 6.3 保存 PM2 进程表

确认两个服务正常后再执行：

```bash
pm2 save
```

不要为了普通接口错误执行 `pm2 delete all`。这会同时移除 API 和管理后台进程定义。

## 7. API 日常发布流程

### 7.1 发布前检查和备份

```bash
cd /home/deploy/liftmark
git status --short
git branch --show-current
git log --oneline -5
pm2 status liftmark-api
bash scripts/backup_database.sh
ls -lh backups/liftmark_*.sql.gz | tail -5
```

只有确认备份成功且 Git 工作区无未知修改，才能继续。

### 7.2 拉取代码

```bash
cd /home/deploy/liftmark
git fetch origin
git log --oneline HEAD..origin/master
git pull --ff-only origin master
```

使用 `--ff-only` 可以避免服务器上意外产生合并提交。

### 7.3 构建和测试 shared

```bash
cd /home/deploy/liftmark/packages/shared
npm ci
npm run typecheck
npm run build
```

### 7.4 构建和测试 API

```bash
cd /home/deploy/liftmark/apps/liftmark-api
npm ci
npm run typecheck
npm run build
mapfile -d '' TEST_FILES < <(find src -type f -name '*.test.ts' -print0)
npx tsx --test "${TEST_FILES[@]}"
```

任何一步失败都停止发布，不要重启到失败的构建。

### 7.5 migration 和 seed

仅当该版本交接文档明确要求时执行：

```bash
npm run db:migrate
npm run db:seed
```

不要把 migration/seed 当成每次重启的固定步骤。执行前必须确认备份，并阅读本次版本说明。

### 7.6 重载和验证

```bash
cd /home/deploy/liftmark
pm2 reload apps/liftmark-api/ecosystem.config.js --only liftmark-api
pm2 status liftmark-api
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/migration-health
curl -fsS http://47.100.239.29/api/health
pm2 logs liftmark-api --err --lines 50 --nostream
```

## 8. 管理后台发布流程

后台源码变化后才需要重新构建；API 变化不需要重建后台。

```bash
cd /home/deploy/liftmark
git status --short
git pull --ff-only origin master

cd management-console
npm ci
npm run typecheck
npm run lint
```

部署脚本会重新安装依赖、执行 build 并替换 `admin-deploy`，执行前先保留旧运行目录：

```bash
STAMP=$(date +%Y%m%d_%H%M%S)
cp -a /home/deploy/liftmark/admin-deploy "/home/deploy/liftmark/admin-deploy.bak.${STAMP}"
cd /home/deploy/liftmark
bash scripts/deploy_admin.sh
pm2 restart liftmark-admin --update-env
pm2 status liftmark-admin
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3001/admin/login
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://47.100.239.29/admin/login
```

## 9. Nginx 排查

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 100 --no-pager
```

只有 `nginx -t` 成功后才能重载：

```bash
sudo systemctl reload nginx
```

常见判断：

- 公网 502：通常是 3000/3001 未监听，或 Nginx upstream 配错。
- 公网 404、内网正常：检查 `/api/`、`/admin/` location 和尾部斜杠。
- App 超时但服务器健康：检查阿里云安全组、本机网络和 HTTP/HTTPS 配置。
- 头像 404：先确认请求是具体文件 `/uploads/avatars/{filename}`，不是目录地址。

## 10. PostgreSQL 只读检查

不要执行 `cat .env`。以下方式只把连接串加载到当前 shell：

```bash
cd /home/deploy/liftmark/apps/liftmark-api
set -a
source .env
set +a
psql "$DATABASE_URL"
```

进入 psql 后先开启只读事务：

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user, now();
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM workout_sessions;
ROLLBACK;
```

查看迁移健康情况优先使用：

```bash
curl -fsS http://127.0.0.1:3000/api/migration-health
```

不要在不清楚关联关系时直接删除用户。用户可能关联会员、refresh token、小组、训练、计划、反馈和审计记录。

## 11. Smoke 账号说明

仓库脚本：

```text
training-partner-app/scripts/api-smoke-test.js
```

执行以下命令时，脚本不仅检查健康状态，还会调用真实注册接口：

```bash
cd /home/deploy/liftmark/training-partner-app
npm run test:api-smoke
```

每运行一次都会创建：

- 手机号：`199` 加当前时间戳末 8 位。
- 昵称：`Smoke` 加手机号末 4 位。
- 一条真实 `users` 记录。
- 一条免费会员记录。
- 注册、登录和 refresh 产生的 token 记录。

这些 `199` 号码只是脚本拼接结果，并不是运营商预留的“永不属于真人”的测试号码，理论上可能与真实手机号碰撞。脚本没有自动清理逻辑。因此，不要把它当作生产环境的日常健康检查，也不要对这些号码发送真实短信。生产只读验证使用：

```bash
curl -fsS http://47.100.239.29/api/health
curl -fsS http://47.100.239.29/api/migration-health
```

`LIFTMARK_SMOKE_SMS=1` 还会调用发送验证码接口，只允许在明确使用 mock 短信服务的隔离环境运行，不要在生产环境随意开启。

截至 2026-08-02 的只读核查结果：生产库有 5 个 `SmokeXXXX` 账号，均创建于 2026-06-24；它们没有小组、计划或训练记录。清理这些账号应作为独立的数据修正任务，在备份、关联检查和 SQL 审核后执行，本手册不提供直接删除命令。

## 12. 鉴权和后台错误排查

### 12.1 401 Unauthorized

常见原因：access token 缺失、无效或过期。后台应清除旧 token 并跳转登录页。先刷新并重新登录，不要重启数据库。

```bash
pm2 logs liftmark-api --lines 100 --nostream | grep -E 'UNAUTHORIZED|jwt|TokenExpired'
```

### 12.2 403 Forbidden

登录有效，但账号不是管理员或权限不足。检查用户角色，不要通过修改 176/188 数据绕过权限。

### 12.3 500 Internal Server Error

先记录发生时间、页面和操作，再查同一时间段日志：

```bash
pm2 logs liftmark-api --lines 200 --nostream
```

重点记录：

- 请求路径与 `reqId`。
- PostgreSQL 错误中的表名或字段名。
- JWT、Zod、文件权限或网络异常类型。
- 故障是否仅影响一个接口，还是 `/api/health` 也失败。

## 13. App 与服务器联调

先在电脑验证公网 API：

```powershell
Invoke-WebRequest -UseBasicParsing http://47.100.239.29/api/health
```

再用手机浏览器打开：

```text
http://47.100.239.29/api/health
```

如果电脑能访问、手机不能访问，优先排查手机网络、运营商、HTTP 明文限制和安全组。

Android 设备日志：

```powershell
adb devices
adb logcat -c
adb logcat | Select-String -Pattern 'LiftMark|ReactNativeJS|Network|SQLite|sync'
```

联调训练时必须遵守：训练先写本地 SQLite，服务器失败不能导致本地训练丢失。写入型验收使用 188 或独立测试账号，不使用 176 制造测试训练。

## 14. 常见故障对照表

| 现象 | 首查 | 常用处理 |
|---|---|---|
| App 提示连接不上服务器 | 公网 `/api/health` | 查 Nginx、3000 端口、安全组 |
| API health 失败 | `pm2 status liftmark-api` | 查 API 错误日志，确认构建后再 reload |
| 后台打不开 | 3001 和 `liftmark-admin` | 重启后台，检查 standalone 产物 |
| 后台显示服务器内部错误 | API 对应请求日志 | 按 reqId 查真实异常，不先重启数据库 |
| 登录后立刻退出 | JWT 401/过期日志 | 重新登录，检查服务器时间与 JWT 配置 |
| 公网 502 | 本地 3000/3001 | 修复进程后 reload Nginx |
| migration-health 503 | 缺失表列表 | 备份后按版本文档执行 migration |
| 训练上传失败 | 本地队列和 `/sync/push` 日志 | 保留本地数据，修复网络后重试同步 |
| 账号数据串号 | owner/group scope | 立即停止写入，保护 176，做只读审计 |

## 15. 回滚原则

### 15.1 代码发布失败

1. 不要执行 `git reset --hard`。
2. 保留失败日志和当前 commit hash。
3. 优先通过 GitHub 创建 `git revert <commit>`，重新构建并部署撤销提交。
4. 如果只是管理后台产物失败，可临时恢复部署前备份目录，再重启 `liftmark-admin`。

### 15.2 数据库问题

数据库恢复会覆盖数据，不能作为普通调试动作。必须：

1. 停止写入。
2. 再做一次故障现场备份。
3. 明确恢复时间点和影响范围。
4. 在隔离库验证备份可恢复。
5. 获得明确确认后才操作生产库。

## 16. 每次排障建议记录

```text
发生时间：
用户/测试账号：
设备和 App 版本：
页面与操作：
请求路径：
HTTP 状态：
PM2 进程状态：
相关 reqId：
核心错误：
是否涉及数据库写入：
修复 commit：
部署时间：
验证结果：
是否需要继续观察：
```

这样可以避免只记录“服务器坏了”，却无法复现和定位真实故障。
