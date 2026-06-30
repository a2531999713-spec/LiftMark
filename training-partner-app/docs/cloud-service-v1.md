# 云服务第一版闭环

更新时间：2026-07-01

## 0. 当前部署状态

公网 API Base URL：

```text
http://47.100.239.29/api
```

当前服务器状态：

- `GET /api/health` 已通过公网健康检查。
- PostgreSQL 已连接成功。
- migration 已执行成功。
- seed 已执行成功，初始管理员已创建。
- PM2 `liftmark-api` online。
- Nginx 已将 `/api` 转发到 `127.0.0.1:3000`。

## 1. 位置

后端工程位于仓库根目录：

```text
apps/liftmark-api
```

App 工程仍位于：

```text
training-partner-app
```

## 2. 技术栈

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Knex schema migration
- JWT accessToken / refreshToken
- PM2
- Nginx `/api` 反向代理

## 3. 已实现 API 范围

- 基础检查：`GET /api/health`、`GET /api/db-check`
- 账号：发送验证码、注册、密码登录、验证码登录、刷新 token、获取当前用户、退出登录、更新头像
- 短信：`mock` 与阿里云 Dypns provider，生产环境不返回 debug code
- 会员与激活：会员状态、激活码兑换、后台创建/停用激活码、后台发放会员
- 小组：创建、列表、详情、加入、退出、成员列表
- 同步：`push`、`pull`、`status`，支持 `client_id` / `server_id` 映射、软删除、版本号和更新时间冲突策略
- 小组训练数据：上传、列表、概览、成员统计、动作统计和成员动作对比
- 成就：基于已同步训练数据计算第一组成就
- 公告、版本配置、反馈
- 后台管理 API：用户、小组、激活码、会员发放、反馈、公告、配置和同步状态

## 3.1 客户端当前接入范围

- API baseUrl 由 `src/config/api.ts` 统一配置，默认指向 `http://47.100.239.29/api`。
- App 当前 UI 暴露双登录：手机号 / 练刻 ID + 密码登录，以及手机号验证码登录 / 注册。
- 后端 `users` 表保存服务端生成的注册顺序与活动字段：`registration_seq`、`registered_at`、`registration_source`、`campaign_code`、`early_user_tier`，可用于前 100 用户和活动资格判断。
- Token 使用 `expo-secure-store` 保存。
- “我的 / 账号设置”显示当前服务器连接状态。
- “云同步”入口显示“开发中 / 可测试”，当前只测试服务连通性，不自动上传本地训练数据。
- 所有网络失败必须降级为页面提示或离线状态，不影响本地 SQLite 训练闭环。

## 4. 数据边界

App 本地训练仍以 SQLite 为主入口。本次没有修改 App 本地 SQLite schema，也没有修改本地 Repository 公共接口。

云端同步表保存服务端副本和映射：

```text
exercises
workout_sessions
workout_sets
training_plans
plan_days
plan_exercises
sync_mappings
sync_state
```

第一版冲突策略：同一 `user_id + client_id` 的记录，按 `client_updated_at` 新者优先。删除使用 `deleted_at` 软删除。

## 5. 未完成边界

- 未接真实支付。
- 未实现 WebSocket 多人实时同练。
- 未接视频/图片云存储。
- App 端尚未把本机 SQLite 训练记录自动打包进入同步队列；当前 `立即同步` 只验证账号 token 和云同步服务连通性。
- 账号注销、修改密码、登录设备管理保留入口，后端业务流程后续补齐。

## 6. Smoke Test

客户端提供最小 API smoke 脚本：

```bash
cd training-partner-app
npm run test:api-smoke
```

默认覆盖：

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`

短信验证码发送默认跳过，避免非 mock 配置误发真实短信。确认服务器 `SMS_PROVIDER=mock` 后可运行：

```bash
LIFTMARK_SMOKE_SMS=1 npm run test:api-smoke
```
