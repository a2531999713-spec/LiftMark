# 练刻 LiftMark 分阶段架构收敛执行计划

> 本文档用于指导 Codex / 后续 AI 开发工具 / 项目维护者按照 `LiftMark-完整架构设计方案.md` 对项目进行分阶段架构收敛。
>
> **最高优先级架构依据**：[`LiftMark-完整架构设计方案.md`](./LiftMark-完整架构设计方案.md)。当本计划与该文档冲突时，以架构设计方案为准；当涉及产品策略不确定时，不要擅自改成自己的理解，先标注出来等待人工确认。
>
> **核心原则**：第一阶段只做最小架构收敛，不要一次性重构全部功能。每个阶段完成后都要运行类型检查、构建或测试，并说明改了哪些文件、为什么改、有没有破坏兼容、如何验证、下一阶段建议做什么。

---

## 0. 当前项目基本情况

```text
LiftMark/
  training-partner-app/      # 移动端 App，Expo / React Native
  apps/liftmark-api/         # 服务端 API，Fastify / Knex / PostgreSQL
  backend/                   # 当前后台管理系统目录，第一阶段改名为 management-console/
  scripts/
  LiftMark-完整架构设计方案.md  # 最高优先级架构依据
  README.md
  PRODUCT.md
  CHANGELOG.md
```

重要事实：

1. `backend/` 不是服务端 API，而是后台管理系统。因名称易混淆，第一阶段改名为 `management-console/`。
2. `apps/liftmark-api/` 才是真正的服务端 API。
3. `training-partner-app/` 是移动端 App，目标 Android 与 iOS 功能一致，当前只是用 Android 设备测试，**不是 Android 独占或 Android 优先**。
4. `backend/` 目录下存在 3 个中文文档（功能实现对照表、后台管理问题排查、后台设计方案），改名时必须一并带过去，不能丢失。

---

## 1. 已识别的主要差异（摘要）

详细差异分析见对话记录，此处仅摘要驱动分阶段计划的关键问题：

| 类别 | 问题 | 严重度 |
|---|---|---|
| 目录命名 | `backend/` 未改为 `management-console/`；`docs/` 不存在；根目录文档散落 | 🟡 |
| 账号注册 | `/auth/register` 允许"密码 OR 验证码"二选一，纯密码可绕过验证码注册 | 🔴 严重 |
| 同步事务 | `/sync/push` 逐条 upsert，未事务化，前半批成功后半批失败会导致半同步 | 🔴 严重 |
| 后台认证 | management-console 启动仅信任 localStorage，不调 `/admin/auth/me`；且该端点不存在 | 🔴 严重 |
| 安全基线 | CORS `origin: true` 允许所有来源；全局无限流；API base 硬编码 HTTP IP | 🔴 严重 |
| 设备管理 | `user_devices` / `user_sessions` 表不存在，登录设备管理完全未实现 | 🟠 |
| 小组权限 | `group_member_permissions` 表不存在；小组权限体系未实现 | 🟠 |
| 代记录结构 | 待确认数据为单层表 `pending_training_data`，架构建议两层（submissions + recipients） | 🟠 |
| 本地游客成员 | `memberType: 'local'`、`guest_preview` 仍在代码中 | 🟠（后期处理） |
| 移动端状态 | 训练执行页 2493 行 / 23 个 useState，无状态机，无 Provider 分层 | 🟠 |
| AI 预留 | recommendation_snapshots / workout_features / model_versions 等表全部不存在 | 🟠 |
| 训练房间 | training-rooms 模块已存在为预留，未接入主流程 | ✅ 符合 |
| 密钥安全 | `git ls-files` 仅返回两个 `.env.example` 模板，无真实密钥入库 | ✅ 符合 |

---

## 2. 总体阶段划分

```text
第一阶段：最小架构收敛（目录 + 文档 + 安全骨架 + 注册漏洞 + 同步事务最小修正）
第二阶段：账号体系与设备管理
第三阶段：安全基线与限流
第四阶段：自动无感同步
第五阶段：小组真实成员与权限
第六阶段：小组代记录与待确认训练数据增强
第七阶段：后台管理系统扩展
第八阶段：会员权益重新设计
第九阶段：AI / 智能推荐预留
第十阶段：移动端状态管理与训练执行页重构
第十一阶段：文档体系整理
第十二阶段：测试、部署与性能优化
```

每个阶段都必须遵循：

```text
1. 先分析，再修改
2. 不删除现有有效功能
3. 不提交密钥
4. 不写成 Android-only
5. 每阶段完成后运行 typecheck / build / test
6. 每阶段输出：改了哪些文件 / 为什么改 / 是否破坏兼容 / 如何验证 / 下一阶段建议
```

---

## 3. 第一阶段：最小架构收敛

### 3.1 阶段目标

在不破坏现有功能的前提下，完成目录命名收敛、文档骨架建立、最高优先级安全漏洞修复（注册绕过、同步事务），并准备安全配置骨架。**不一次性重构全部功能。**

### 3.2 修改范围

#### 3.2.1 目录与命名修正

- 使用 `git mv backend/ management-console/` 重命名（保留 Git 历史）
- 修改所有引用旧路径的脚本、README、部署文档、package 配置
- `management-console/package.json` 的 `name` 从 `"my-project"` 改为 `"management-console"`，并补 `typecheck` 脚本（`tsc --noEmit`）以满足验证要求
- 服务端 API 保持 `apps/liftmark-api/`
- 移动端保持 `training-partner-app/`，本阶段不迁移

完成后目录目标：

```text
LiftMark/
  training-partner-app/
  apps/
    liftmark-api/
  management-console/
  docs/
  scripts/
```

#### 3.2.2 文档目录整理

- 新建 `docs/` 及以下子目录骨架（对齐架构文档 §19）：

```text
docs/
  00-project/
  01-product/
  02-design/
  03-architecture/
  04-api/
  05-database/
  06-mobile/
  07-backend-api/
  08-management-console/
  09-sync/
  10-security/
  11-deployment/
  12-testing/
  13-ai-intelligence/
  14-business/
  15-operations/
  16-prompts/
  99-archive/
```

- 第一阶段只创建 `docs/` 目录骨架
- 只移动 `LiftMark-完整架构设计方案.md` 到 `docs/03-architecture/`
- 根目录 `README.md` 指向新架构文档位置
- 其他历史文档、图片、zip、参考样式图、测试文件（如 `RELEASE.md`、`RELEASE_NOTES.md`、`DEPLOYMENT_BEST_PRACTICES.md`、`liftmark_sync_architecture.svg`、`test_upload.*`、`liftmark_ab_8week_hypertrophy_plan_v4_fixed.json` 等）暂时不移动，只生成整理清单，列出建议归档目标位置
- 完整归档放到第十一阶段"文档体系整理"
- 不删除任何有用文档
- 不移动 `.pem`、`.env`、密钥到 Git 可提交区域；发现密钥只更新 `.gitignore` 和文档提醒

#### 3.2.3 README / PRODUCT / 部署脚本更新

- 根 `README.md`：补全三端结构（移动端 / 服务端 API / management-console），修正 `cd -/training-partner-app` 错误路径，指向架构文档
- `PRODUCT.md`：删除 "Android-first"，改为"Android 与 iOS 功能一致，当前用 Android 设备测试"
- `scripts/deploy_admin.sh`：`/home/deploy/liftmark/backend` 改为 `management-console`
- 核查 `apps/liftmark-api/ecosystem.config.js` 中 admin 相关引用

#### 3.2.4 修复 `/auth/register` 密码绕过手机号验证码

当前 `apps/liftmark-api/src/modules/auth/auth.routes.ts` 的 `/auth/register` 允许"密码 OR 验证码"二选一，纯密码可绕过验证码注册，**直接违反架构文档 §4.1"注册必须强制手机号验证码"**。

最小修正：

- `/auth/register` **强制要求 `code`**，移除"密码可绕过验证码"分支
- 验证码校验通过后才创建用户
- 密码改为注册成功后可选设置（完整"首次设密码需验证码"流程放第二阶段）

#### 3.2.5 `/sync/push` 最小事务化

当前 `apps/liftmark-api/src/modules/sync/sync.routes.ts` 的 `/sync/push` 用 `for` 循环逐条 upsert，每条独立提交，**违反架构文档 §7.5"一批同步数据要么整体成功，要么整体失败"**。

最小修正：

- 用 `db.transaction` 包裹整批 upsert + sync_state 更新，保证原子性
- 整批失败时事务回滚，返回明确错误码

#### 3.2.6 检查移动端同步失败标记逻辑

- 核查 `training-partner-app/src/sync/syncService.ts` 在 `/sync/push` 整批失败时的 `markSyncItemFailed` 调用
- 事务化后整批失败需回退全部 pending，不能出现"服务端全部回滚但移动端标记部分成功"
- 第一阶段若移动端重试逻辑不完善，在 CHANGELOG 标注此限制，完整重试逻辑放第四阶段

#### 3.2.7 增加 CORS 配置骨架

- `apps/liftmark-api/src/config/env.ts` 新增 `corsAllowedOrigins` 读取 `CORS_ALLOWED_ORIGINS`
- `apps/liftmark-api/src/app.ts` CORS 由 `origin: true` 改为按环境读取白名单
  - development 环境可以允许 localhost、局域网调试地址
  - production 环境必须读取 `CORS_ALLOWED_ORIGINS`
  - production 环境如果未配置 `CORS_ALLOWED_ORIGINS`，服务端必须启动失败
  - production 环境绝不允许回退到 `origin: true`
- `apps/liftmark-api/.env.example` 补 `CORS_ALLOWED_ORIGINS` 说明
- `management-console/lib/api.ts` 的 `API_BASE` 从硬编码 HTTP IP 改为读 env，并在 `.env.example` 补说明
- 完整限流（`@fastify/rate-limit`）放第三阶段，本阶段只做配置骨架

### 3.3 重点文件清单

```text
目录改名：
  git mv backend/ management-console/
  management-console/package.json            # name + typecheck 脚本
  scripts/deploy_admin.sh                    # 部署路径
  apps/liftmark-api/ecosystem.config.js      # 核查 admin 引用

文档目录：
  docs/                                      # 新建 17 个子目录
  docs/03-architecture/                      # 移入架构设计方案
  docs/99-archive/                           # 归档历史文档
  README.md                                  # 三端结构 + 路径修正
  PRODUCT.md                                 # 去 Android-first

注册漏洞修复：
  apps/liftmark-api/src/modules/auth/auth.routes.ts   # /auth/register

同步事务化：
  apps/liftmark-api/src/modules/sync/sync.routes.ts   # /sync/push
  training-partner-app/src/sync/syncService.ts        # 核查失败标记

CORS 骨架：
  apps/liftmark-api/src/config/env.ts
  apps/liftmark-api/src/app.ts
  apps/liftmark-api/.env.example
  management-console/lib/api.ts
```

### 3.4 第一阶段不做什么

```text
- 不做在线训练房间（training-rooms 仅保留预留）
- 不做 WebSocket / SSE 实时协同
- 不做大规模训练页重构（放第十阶段）
- 不一次性删除本地游客成员逻辑（放第五阶段）
- 不做 AI 模型服务（放第九阶段）
- 不大规模移动图片、zip、参考图、历史文件（仅创建 docs 骨架 + 移动架构文档，其余只生成整理清单）
- 不使用 git add .（只 add 明确文件）
- 不提交 .pem / .env / 服务器密钥 / 阿里云密钥
- 不把项目写成 Android-only
- 不把后台管理系统继续叫 backend
- 不做完整限流（放第三阶段）
- 不做设备管理表（放第二阶段）
- 不做 sync_batch / 幂等三件套（放第四阶段）
```

### 3.5 风险点

1. **注册绕过漏洞是已上线行为**：修正后历史纯密码注册账号不受影响（只拦新注册）。需复核 `training-partner-app/src/store/authStore.ts` 的 `register` 是否传了 `code`，确认移动端走的是验证码流程。

2. **`/sync/push` 事务化可能放大失败面**：原本单条失败不影响其他条，事务化后整批回滚。第一阶段服务端事务化后，若移动端 `markSyncItemFailed` 仍是逐条标记，可能出现"服务端全部回滚但移动端标记部分成功"的短暂不一致。第一阶段在 CHANGELOG 标注此限制，完整重试逻辑放第四阶段。

3. **目录改名影响部署**：`scripts/deploy_admin.sh` 改路径后，生产服务器上的 `/home/deploy/liftmark/backend` 旧目录不会自动改名。需在部署文档注明：服务器侧需手动 `mv` 或重新 clone。第一阶段只改仓库内脚本，不碰服务器。

4. **`management-console/` 补 `typecheck` 脚本**：Next.js 项目 typecheck 用 `tsc --noEmit`，需确认 `tsconfig.json` 配置正确，否则可能暴露大量既有类型错误。若 typecheck 报错较多，评估是否本阶段修或顺延。

5. **CORS 白名单化可能阻断现有客户端**：production 环境强制读取 `CORS_ALLOWED_ORIGINS`，未配置则服务端启动失败。部署前必须确认 `CORS_ALLOWED_ORIGINS` 与生产环境移动端 API 地址一致，否则服务端无法启动或客户端 403。第一阶段通过 `.env.example` 和部署文档明确标注此要求。

6. **未在第一阶段处理但需提醒的高危项**（本阶段不改，按"不一次性改完"执行）：
   - 后台 localStorage 信任问题（🔴，第三阶段修，在此之前后台安全性依赖网络层）
   - 全局限流缺失（🔴，第三阶段修）
   - `/admin/auth/me` 端点不存在（第三阶段修）

### 3.6 验证方式

移动端：

```bash
cd training-partner-app
npm install
npm run typecheck
npm run lint
npm test
```

服务端 API：

```bash
cd apps/liftmark-api
npm install
npm run typecheck
npm run build
```

后台管理系统：

```bash
cd management-console
npm install
npm run typecheck   # 第一阶段补齐的脚本
npm run build
```

若某项目暂无对应脚本，说明实际可运行脚本，不强行编造。

### 3.7 完成标准

- [ ] `backend/` 已 `git mv` 为 `management-console/`，旧路径引用全部清理
- [ ] `docs/` 17 个子目录骨架已建立
- [ ] `LiftMark-完整架构设计方案.md` 已移入 `docs/03-architecture/`
- [ ] README 已指向新架构文档位置
- [ ] 历史文档整理清单已生成（实际归档放到第十一阶段）
- [ ] README / PRODUCT / 部署脚本已更新，无 "Android-first"
- [ ] `/auth/register` 不再允许纯密码绕过验证码
- [ ] `/sync/push` 已用 `db.transaction` 包裹整批
- [ ] 移动端同步失败标记逻辑已核查并标注限制
- [ ] CORS 配置骨架已建立，production 未配置 `CORS_ALLOWED_ORIGINS` 时服务端启动失败，`.env.example` 已补说明
- [ ] 三端 `typecheck` / `build` / `test` 通过
- [ ] 无密钥进入 Git
- [ ] CHANGELOG 已更新本阶段变更

---

## 4. 第二阶段：账号体系与设备管理

### 4.1 阶段目标

按架构文档 §4、§5 完成账号体系修正，增加登录设备管理数据结构和接口预留。

### 4.2 修改范围

- 注册强制手机号验证码（第一阶段已堵绕过，本阶段完善流程）
- 登录支持：手机号验证码、手机号+密码、练刻 ID+密码、邮箱+密码（预留）
- 新增 `liftmark_id` 登录支持
- 新增邮箱绑定预留
- access token 短期化（7d → 例如 15m），refresh token 长期化
- 新增 `user_devices` 表
- 新增 `user_sessions`（或 `auth_sessions`）表
- 新增 `user_auth_identities` 表（第三方账号绑定预留）
- 新增换绑接口骨架：`/auth/change-phone`、`/auth/change-email`
- App 启动 refresh token 静默刷新（移动端已基本实现，核查即可）

### 4.3 重点文件

```text
apps/liftmark-api/src/db/migrate.ts                              # 新建表
apps/liftmark-api/src/modules/auth/auth.routes.ts                # 登录方式扩展
apps/liftmark-api/src/utils/tokens.ts                            # token 有效期调整
training-partner-app/src/services/auth/authService.ts            # 静默刷新核查
training-partner-app/src/store/authStore.ts                      # 登录态保持
```

### 4.4 不做什么

- 不做第三方登录实际接入（仅预留表结构）
- 不做后台设备管理 UI（放第七阶段）
- 不破坏已有密码注册用户数据

### 4.5 风险点

- access token 有效期缩短可能导致现有客户端频繁刷新，需保证移动端静默刷新稳定
- 换绑流程涉及安全验证，需确保不绕过验证码

### 4.6 验证方式

- 服务端 `typecheck` / `build`
- 手动测试注册、登录、刷新、登出
- 验证旧账号仍可登录

### 4.7 完成标准

- 注册必须验证码，无绕过路径
- 设备管理表已建立
- 多登录方式骨架已就位

---

## 5. 第三阶段：安全基线与限流

### 5.1 阶段目标

按架构文档 §16 建立完整安全基线。

### 5.2 修改范围

- CORS 严格白名单核查（第一阶段已在 production 强制读取 `CORS_ALLOWED_ORIGINS`，本阶段复核 dev/prod 分级并补测试用例）
- 注册 `@fastify/rate-limit`，对以下接口限流：
  - `/auth/send-code`、`/auth/login-with-code`、`/auth/password-login`、`/auth/refresh`
  - `/auth/change-phone`、`/auth/change-email`
  - `/sync/push`、`/pending-training/upload`、`/pending-training/:id/accept`
  - `/activation-codes/redeem`、`/management-console/login`
- 密码登录失败次数限制与锁定
- 新增 `GET /admin/auth/me` 端点
- `management-console` 启动时调用 `/admin/auth/me` 校验，无效则清空本地跳登录
- 后台审计日志：管理员登录、数据修改、会员变更、权限变更、敏感操作
- 后台高危操作二次确认 + 填写原因
- 列表接口分页
- HTTPS 配置预留（Nginx 层，文档说明）

### 5.3 重点文件

```text
apps/liftmark-api/src/app.ts                                    # 注册限流插件
apps/liftmark-api/src/modules/admin/admin.routes.ts             # /admin/auth/me
apps/liftmark-api/src/modules/admin/admin.extended.routes.ts    # 审计日志
management-console/lib/auth-context.tsx                         # 启动校验
management-console/lib/api.ts                                   # HTTPS base
```

### 5.4 不做什么

- 不做完整 RBAC（后台仅超级管理员）
- 不做 IP 黑名单动态管理

### 5.5 风险点

- 限流配置过严可能误伤正常用户，需按接口分级
- 后台启动校验失败可能导致管理员被锁出，需保留恢复路径

### 5.6 验证方式

- 服务端 typecheck / build
- 手动触发限流、登录失败锁定、后台 token 失效跳转
- 审计日志可查

### 5.7 完成标准

- 限流生效
- 后台启动校验服务端
- 审计日志可记录敏感操作

---

## 6. 第四阶段：自动无感同步

### 6.1 阶段目标

按架构文档 §7 实现事务化、幂等、分页、自动触发的同步。

### 6.2 修改范围

- `/sync/push` 新增 `sync_batch` 批次记录
- 幂等三件套：`client_mutation_id`、`client_entity_id`、`device_id`
- `/sync/pull` 增量拉取 + 分页 + 索引
- 同步失败记录原因，移动端可重试
- 移动端同步失败标记逻辑完善（事务化整批回退）
- 移动端新增 NetInfo 网络恢复触发
- 启用 `scheduleSyncDebounced`（当前定义未调用）
- 训练中保存 debounce / batch，不每组都请求服务器
- SyncProvider 封装（移动端）

### 6.3 重点文件

```text
apps/liftmark-api/src/modules/sync/sync.routes.ts
apps/liftmark-api/src/db/migrate.ts                             # sync_batch 表
training-partner-app/src/sync/syncOrchestrator.ts               # 启用 debounce
training-partner-app/src/sync/syncService.ts                    # 失败标记
training-partner-app/src/sync/syncTypes.ts                      # 幂等字段
training-partner-app/app/_layout.tsx                            # NetInfo 触发
```

### 6.4 不做什么

- 不做冲突自动合并策略（保留 local-first 占位）
- 不做 WebSocket 实时同步

### 6.5 风险点

- 幂等字段引入需兼容旧客户端 payload
- debounce 启用可能延迟用户感知同步，需平衡

### 6.6 验证方式

- 同步测试：断网恢复、重复推送、整批失败重试
- 三端 typecheck / build / test

### 6.7 完成标准

- `/sync/push` 事务 + 批次 + 幂等
- `/sync/pull` 分页
- 移动端自动触发覆盖架构文档 §7.2 全部时机

---

## 7. 第五阶段：小组真实成员与权限

### 7.1 阶段目标

按架构文档 §8、§9 建立真实账号小组与权限体系，去除本地游客成员作为长期架构。

### 7.2 修改范围

- 小组成员必须真实账号
- 去除本地游客成员 / `guest_preview` / `memberType: 'local'`
- 新增 `group_member_permissions` 表
- 默认权限按架构文档 §9.2
- 小组加入方式：邀请链接、邀请码、二维码、房间码、练刻 ID 搜索
- 修改训练记录权限控制（他人修改需进入待确认或留审计）

### 7.3 重点文件

```text
apps/liftmark-api/src/db/migrate.ts
apps/liftmark-api/src/modules/groups/groups.routes.ts
training-partner-app/src/domain/member/member.types.ts          # 去除 guest/local
training-partner-app/src/domain/member/member-selection.ts
training-partner-app/src/data/local/repositories/memberRepository.ts
training-partner-app/src/domain/auth/access-control.ts
```

### 7.4 不做什么

- 不做在线训练房间
- 不做小组排行榜完整实现（仅权限预留）

### 7.5 风险点

- 去除本地游客成员可能影响已有本地数据，需数据迁移
- 权限默认值变更需用户感知

### 7.6 验证方式

- 小组创建、邀请、加入、权限修改测试
- 旧本地成员数据迁移验证

### 7.7 完成标准

- 小组成员全部真实账号
- 权限表与默认值就位
- 本地游客成员逻辑移除

---

## 8. 第六阶段：小组代记录与待确认训练数据增强

### 8.1 阶段目标

按架构文档 §10 完善小组代记录与待确认流程，增强为两层结构。

### 8.2 修改范围

- 在现有 `pending_training_data` 基础上增强，不盲目删除
- 新增 `group_workout_submissions` + `group_workout_submission_recipients` 两层结构
- 一次提交支持多人（A 记录 B、C，分别生成待确认）
- 确认时服务端事务写入正式记录
- 拒绝记录状态和原因
- 幂等：避免重复上传、重复确认
- 后台可查看、处理异常待确认数据
- 小组统计只统计 accepted 和 self_recorded

### 8.3 重点文件

```text
apps/liftmark-api/src/db/migrate.ts
apps/liftmark-api/src/modules/pending-training/pendingTraining.routes.ts
training-partner-app/app/pending-training/index.tsx
training-partner-app/app/workout/upload-members.tsx
```

### 8.4 不做什么

- 不做在线同练房间
- 不做实时推送（待确认通过 pull 拉取）

### 8.5 风险点

- 两层结构迁移需保证旧 `pending_training_data` 数据可读
- 幂等字段引入需兼容

### 8.6 验证方式

- A 代 B、C 记录 → B、C 确认 / 拒绝全流程测试
- 重复上传幂等测试

### 8.7 完成标准

- 两层待确认结构就位
- 幂等生效
- 小组统计口径正确

---

## 9. 第七阶段：后台管理系统扩展

### 9.1 阶段目标

按架构文档 §13 扩展 management-console 完整功能。

### 9.2 修改范围

覆盖架构文档 §13.2 全部 20 个模块：仪表盘、用户账号管理、登录设备管理、小组管理、小组权限管理、训练记录管理、待确认训练数据管理、同步状态管理、数据修复工具、会员管理、激活码管理、订单/支付预留、反馈管理、公告管理、App 配置管理、AI 智能推荐管理、文件管理、系统日志、审计日志、备份恢复。

特殊数据处理支持：用户训练数据异常、重复同步、训练记录归属错误、组员上传错人、手机号/邮箱换绑失败、小组权限异常、会员权益发放错误、待确认数据长期未处理、头像上传异常、设备同步卡住。

所有高危操作：二次确认 + 操作原因 + 审计日志 + 必要时回滚。

### 9.3 重点文件

```text
management-console/app/(admin)/               # 各功能页
management-console/lib/api.ts
apps/liftmark-api/src/modules/admin/          # 后台接口
```

### 9.4 不做什么

- 不做普通用户后台（仅超级管理员）
- 不做多租户

### 9.5 风险点

- 高危操作回滚需事务支持
- 大表查询必须分页，避免一次性拉全量

### 9.6 验证方式

- management-console `typecheck` / `build`
- 各功能页手动验证
- 审计日志可查

### 9.7 完成标准

- 20 个功能模块就位
- 高危操作全部有审计
- 列表全部分页

---

## 10. 第八阶段：会员权益重新设计

### 10.1 阶段目标

按架构文档 §14 重新设计会员权益，免费用户不被限制到无法使用核心训练功能。

### 10.2 修改范围

- 免费用户：手机号注册/登录、基础云同步、换设备恢复、个人训练记录、基础计划、基础历史、加入小组、创建 1 个小组（最多 2 人）、待确认数据、基础分析、基础智能建议
- Pro 会员：可激活 3 个小组、每组最多 4 人、高级分析、动作趋势、小组对比、周报/月报、智能重量推荐、智能疲劳提醒、批量编辑、数据导出、更多权限控制、长期趋势
- 永久会员：长期 Pro + 永久个人高级分析 + 永久智能推荐 + 永久指定数量小组
- 团队版预留
- 权益由服务端最终判断，移动端仅缓存
- 不破坏已有会员数据迁移

### 10.3 重点文件

```text
apps/liftmark-api/src/modules/memberships/memberships.routes.ts
apps/liftmark-api/src/modules/memberships/membership.service.ts
training-partner-app/src/features/membership/            # 新建
```

### 10.4 不做什么

- 不做支付实际接入（仅订单预留）
- 不做会员过期后历史数据不可访问（架构明确禁止）

### 10.5 风险点

- 旧会员限制逻辑调整需保证已发放权益不丢失

### 10.6 验证方式

- 免费 / Pro / 永久 权益边界测试
- 服务端权益判断生效

### 10.7 完成标准

- 权益分层就位
- 服务端最终判断
- 免费用户核心功能可用

---

## 11. 第九阶段：AI / 智能推荐预留

### 11.1 阶段目标

按架构文档 §15 预留数据结构与接口，第一阶段用规则引擎，不强行训练模型。

### 11.2 修改范围

- 新增表：`recommendation_snapshots`、`recommendation_feedback`、`workout_features`、`model_versions`、`model_predictions`
- 新增模块：`apps/liftmark-api/src/modules/intelligence/`
- 新增移动端：`training-partner-app/src/features/intelligence/`
- 接口：`GET /intelligence/summary`、`/intelligence/recommendations/today`、`/intelligence/recommendations/exercise/:exerciseId`、`POST /intelligence/recommendations/:id/feedback`、`/intelligence/insights/history`、`/intelligence/model/status`
- 第一阶段功能：下次重量建议、是否加重/维持/降重、训练总量趋势、完成率分析、疲劳风险提示、动作薄弱项分析、小组训练总结、训练周报/月报
- AI 逻辑不写在页面里，独立模块

### 11.3 重点文件

```text
apps/liftmark-api/src/db/migrate.ts
apps/liftmark-api/src/modules/intelligence/                # 新建
training-partner-app/src/features/intelligence/           # 新建
```

### 11.4 不做什么

- 不新增复杂 Python 模型服务
- 不宣传 "AI 保证增肌 / 诊断伤病 / 精准预测极限"

### 11.5 风险点

- 规则引擎需基于真实训练数据，需先有足够数据

### 11.6 验证方式

- 服务端 typecheck / build
- 推荐接口可返回规则结果

### 11.7 完成标准

- 数据表与接口预留就位
- 规则引擎可输出基础建议
- AI 逻辑独立于页面

---

## 12. 第十阶段：移动端状态管理与训练执行页重构

### 12.1 阶段目标

按架构文档 §12 重构移动端状态管理，训练执行页拆状态机。

### 12.2 修改范围

- Provider 分层：`RepositoryProvider`、`AuthProvider`、`AccountScopeProvider`、`GroupProvider`、`SyncProvider`
- 训练执行状态机 `WorkoutExecutionMachine`：loading / ready / editing_set / saving_set / resting / switching_member / adjusting_workout / finishing / finished / error
- 训练执行页模块拆分到 `src/features/workout-execution/`
- 训练中允许：临时换动作、添加/删除动作、添加/删除组、修改重量/次数、跳过、结束二次确认、切出 App 回来继续

### 12.3 重点文件

```text
training-partner-app/app/workout/[sessionId].tsx           # 从 2493 行拆分
training-partner-app/src/features/workout-execution/       # 新建
training-partner-app/src/providers/                        # 新建 Provider
training-partner-app/src/data/local/repositories/index.ts  # RepositoryProvider
```

### 12.4 不做什么

- 不做在线同练状态
- 不改训练数据 schema

### 12.5 风险点

- 训练页大改风险高，需充分回归测试
- 状态机引入需保证切出 App 回来继续可用

### 12.6 验证方式

- 移动端 typecheck / lint / test
- 训练全流程回归：开始 → 记录 → 休息 → 换成员 → 调整 → 结束

### 12.7 完成标准

- 训练页不再堆 useState
- 状态机就位
- Provider 分层完成

---

## 13. 第十一阶段：文档体系整理

### 13.1 阶段目标

按架构文档 §19 完善文档体系，根目录只保留必要入口。

### 13.2 修改范围

- 按 17 个子目录归类全部文档
- 历史方案、旧截图、临时文档入 `docs/99-archive/`
- 根目录只保留 README 入口
- 中文文档文件名保留清晰语义

### 13.3 不做什么

- 不删除有用文档
- 不移动密钥到 Git 可提交区域

### 13.4 完成标准

- 文档目录符合架构文档 §19
- 根目录整洁

---

## 14. 第十二阶段：测试、部署与性能优化

### 14.1 阶段目标

建立完整测试、部署、性能基线。

### 14.2 修改范围

移动端性能：启动优化、训练页拆分、SQLite 索引、训练中保存防抖、图片缓存、减少不必要渲染。

服务端性能：分页查询、数据库索引、批量写入、事务控制、慢查询日志、同步限流、训练分析预计算。

后台性能：列表分页、大表搜索加条件、按用户/小组/时间过滤。

部署：Nginx、PM2、PostgreSQL 备份（保留 14 天）、上线检查清单。

测试：接口测试、App 测试、同步测试、权限测试、后台测试。

### 14.3 重点文件

```text
apps/liftmark-api/deploy/nginx/liftmark-api.conf
apps/liftmark-api/ecosystem.config.js
scripts/backup_database.sh
docs/11-deployment/
docs/12-testing/
```

### 14.4 完成标准

- 性能基线达标
- 备份 14 天保留
- 测试覆盖关键链路

---

## 15. 全局禁止事项

```text
1. 不要提交 .pem、.env、服务器密钥、阿里云密钥、数据库密码等敏感信息
2. 不要把项目写成 Android-only，移动端目标是 Android 与 iOS 功能一致，当前只是用 Android 设备测试
3. 不要把后台管理系统继续叫 backend，服务端 API 是 apps/liftmark-api/，后台管理系统是 management-console/
4. 不要绕过手机号验证码注册
5. 不要让小组成员直接写入他人正式训练记录
6. 不要把 AI 推荐逻辑写死在训练页面里
7. 不要继续扩大单个训练页面的 useState
8. 不要把手动同步作为正式用户主流程
9. 不要优先做在线训练房间（training-rooms 仅预留）
10. 不要保留本地游客成员作为长期架构（第五阶段移除）
11. 不要使用 git add .（只 add 明确文件）
12. 不要一次性删除现有有效功能
13. 发现架构文档和现有代码冲突时，以 LiftMark-完整架构设计方案.md 为准
14. 涉及产品策略不确定时，不要擅自改成自己的理解，先标注出来等待人工确认
```

---

## 16. 每阶段输出要求

每个阶段完成后必须输出：

```text
1. 改了哪些文件
2. 为什么改
3. 有没有破坏兼容
4. 如何验证
5. 下一阶段建议做什么
```

并运行对应验证：

```bash
# 移动端
cd training-partner-app && npm install && npm run typecheck && npm run lint && npm test

# 服务端 API
cd apps/liftmark-api && npm install && npm run typecheck && npm run build

# 后台管理系统
cd management-console && npm install && npm run typecheck && npm run build
```

若某项目暂无对应脚本，说明实际可运行脚本，不强行编造。

---

## 17. 架构依据

本计划的唯一最高优先级架构依据为：

[`LiftMark-完整架构设计方案.md`](./LiftMark-完整架构设计方案.md)（位于 `docs/03-architecture/`）

当本计划与该文档冲突时，以架构设计方案为准。
