# 云服务第一版闭环

更新时间：2026-06-24

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
- 账号：发送验证码、注册、密码登录、验证码登录、刷新 token、获取当前用户、退出登录
- 短信：`mock` 与阿里云 Dypns provider，生产环境不返回 debug code
- 会员与激活：会员状态、激活码兑换、后台创建/停用激活码、后台发放会员
- 小组：创建、列表、详情、加入、退出、成员列表
- 同步：`push`、`pull`、`status`，支持 `client_id` / `server_id` 映射、软删除、版本号和更新时间冲突策略
- 小组训练数据：上传、列表、概览、成员统计、动作统计和成员动作对比
- 成就：基于已同步训练数据计算第一组成就
- 公告、版本配置、反馈
- 后台管理 API：用户、小组、激活码、会员发放、反馈、公告、配置和同步状态

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

