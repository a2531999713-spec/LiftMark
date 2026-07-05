# 数据库架构分析与重新设计

更新时间：2026-07-06

## 1. 原架构问题分析

### 1.1 核心缺陷：单库混合存储 + SQL 过滤隔离

原架构将所有账号的数据存储在同一个 SQLite 库（`training_partner.db`），通过 `owner_user_id = ?` 在查询时过滤。这是导致 188/176 账号数据串号的根本原因。

| 问题 | 影响 |
|------|------|
| `owner_user_id` 可被覆盖 | `syncServerDataToLocal` 无条件覆盖归属，A 账号数据被 B 账号"偷走" |
| `owner_user_id` 可为 NULL | 早期数据未回填归属，NULL 归属对所有人可见（"无人认领"状态） |
| 任何查询漏加过滤即泄漏 | 全项目几十个查询点，任何一个遗漏 `WHERE owner_user_id = ?` 都会跨账号泄漏 |
| 切换账号不清理旧数据 | A 账号的数据物理上还在库里，依赖作用域正确性才能隔离 |

### 1.2 migration 回填缺失

migration 15（`account_data_isolation`）只为各表新增了 `owner_user_id` 列，但没有回填存量数据。结果是所有历史数据 `owner_user_id = NULL`，进入"无人认领"状态。

### 1.3 同步单向

原架构只有 push（上传）没有 pull（下载），导致：
- 换设备/重装后训练历史丢失
- 多设备间数据不同步
- 云端只是备份存档，不是真正的同步

### 1.4 归属字段可变

`owner_user_id` 没有"创建后不可变"的约束，被 `syncServerDataToLocal` 的 UPDATE 语句无条件覆盖。正确的做法是 INSERT 时设定，UPDATE 时永不修改。

## 2. 新架构设计

### 2.1 物理分库（P1 阶段实施）

```
存储结构：
┌─────────────────────────────────────────────────────┐
│  AsyncStorage / SecureStore（极小，KV 存储）           │
│  - currentUserId: 当前登录用户 ID                      │
│  - deviceId: 设备唯一标识（首次生成）                   │
│  - authToken: 登录令牌                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  liftmark_global.db（全局共享库，只读参考数据）          │
│  - exercises（动作库，所有用户共享）                    │
│  - exercise_alternatives（替代动作）                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  liftmark_{userId}.db（用户私有库，物理隔离）           │
│  - workout_sessions / workout_exercise_records /      │
│    workout_sets（训练记录）                            │
│  - plan_templates / plan_days / plan_exercises（计划）│
│  - body_metrics / body_metric_goals（身体数据）        │
│  - groups / group_members / member_profiles（社交）   │
│  - local_sync_queue（同步队列）                        │
│  - sync_state（同步游标）                              │
│  整个库只属于这一个用户，无需 owner_user_id 过滤         │
└─────────────────────────────────────────────────────┘
```

### 2.2 为什么这样分

| 数据类型 | 放哪里 | 原因 |
|----------|--------|------|
| exercises / exercise_alternatives | global.db | 全局共享参考数据，所有用户相同，无需隔离 |
| 训练记录/计划/身体数据/设置 | `{userId}.db` | 高度隐私，必须物理隔离 |
| groups / members / profiles | `{userId}.db` | 每个用户看到的视图不同，按用户隔离 |
| 同步队列 / 同步状态 | `{userId}.db` | 每个用户有自己的待同步变更和同步游标 |
| currentUserId / deviceId / token | AsyncStorage | 极小 KV，App 级状态 |

### 2.3 账号切换流程

```text
login(userId):
  1. 如果当前有打开的用户库 → closeDatabase(currentDb)
  2. openDatabase(`liftmark_${userId}.db`) → 跑 migrations
  3. 检查该库是否有数据：
     - 空库（新设备/重装）→ fullPull = true，全量拉取
     - 有数据 → 增量 pull（since = sync_state.last_pull_at）
  4. push 队列中残留的待同步变更（上次可能中断）
  5. 更新 AsyncStorage.currentUserId = userId

logout():
  1. 尽力 push 剩余变更
  2. closeDatabase(currentDb)
  3. 清空内存状态（authStore, 各 repository 缓存）
  4. 保留 DB 文件（方便快速重新登录，不删数据）
```

### 2.4 旧数据迁移（一次性）

从单库迁移到分库时，需一次性迁移脚本：

```text
migrateToPerAccountDb():
  1. 打开旧 liftmark.db
  2. SELECT DISTINCT owner_user_id FROM workout_sessions WHERE owner_user_id IS NOT NULL
  3. 对每个 userId：
     - 创建 liftmark_{userId}.db
     - INSERT INTO ... SELECT * FROM 旧库 WHERE owner_user_id = userId
  4. exercises 复制到 liftmark_global.db
  5. 标记迁移完成，后续不再执行
```

## 3. P0 阶段的过渡方案

P0 阶段在现有单库上修复，不做分库（降低风险快速止血）：

| 修复项 | 实现方式 |
|--------|----------|
| owner_user_id 不可变 | repository UPDATE 语句排除 owner_user_id |
| 归属修复 | migration 16 + ownershipRepairService（云端反查） |
| 双向同步 | pullService.ts + syncOrchestrator.ts |
| 自动同步 | 防抖触发 + 训后立即 + 启动/登录触发 |
| 同步游标 | sync_state 表（migration 17） |

## 4. P1 阶段的分库实施

P1 阶段实施物理分库，彻底消除 SQL 过滤隔离的风险：

| 改造项 | 说明 |
|--------|------|
| accountScope 重构 | 管理 per-account DB 的打开/关闭/切换 |
| db.ts 重构 | 支持多库（global.db + user.db），DB 连接管理器 |
| migrations 适配 | migrations 需在每个新用户库上执行 |
| 旧库迁移脚本 | 一次性从单库迁移到分库，幂等可重复 |
| LWW 冲突解决 | version + updated_at 乐观锁 |

## 5. 表结构变更总结

### P0 已完成的 migration

| Migration | 名称 | 说明 |
|-----------|------|------|
| 16 | `fix_account_ownership` | 回填 NULL 归属 + 修正被错误覆盖的归属 |
| 17 | `sync_state_table` | 新增 sync_state 表记录同步游标 |

### P1 规划的 migration

| Migration | 名称 | 说明 |
|-----------|------|------|
| 18 | `per_account_db_migration` | 从单库迁移到分库（一次性） |
| 19 | `add_version_to_all_tables` | 为所有业务表添加 version 字段（乐观锁） |

## 6. 设计原则（更新）

1. **云端是权威数据源**：服务端 PostgreSQL 是 source of truth，本地 SQLite 是缓存。
2. **本地优先读写**：所有业务读写走本地库，保证离线可用。
3. **Pull 先于 Push**：每次同步先拉后推，减少冲突。
4. **owner_user_id 创建后不可变**：INSERT 时设定，UPDATE 时永不修改。
5. **物理隔离优于逻辑过滤**：P1 阶段实施分库，彻底消除泄漏风险。
6. **前台驱动同步**：不用后台定时任务，靠启动/登录/训后/防抖触发。
7. **LWW 冲突解决**：健身数据以新增为主，LWW 足够可靠。
