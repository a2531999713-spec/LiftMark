# 数据同步架构

更新时间：2026-07-11

## 1. 架构选型：本地优先 + 云端权威

LiftMark 采用 **本地优先（Local-First）+ 云端权威（Cloud-Authoritative）** 同步模型。

- 本地 SQLite 是唯一读写入口，所有业务读写走本地库，保证离线可用和毫秒响应。
- 云端 PostgreSQL 是权威仲裁者，分配 version 号、裁决冲突、作为换设备恢复的数据源。
- 同步流程为 **Pull 先于 Push**：每次同步先拉取服务端最新变更应用到本地，再推送本地待同步变更，减少推送时的版本冲突。
- 登录 / 切换账号的 `fullPull` 会先拉取 `/sync/groups-pull` 的小组和成员结构，再拉取 `/sync/pull` 的训练、计划、体测等业务数据。
- 不使用后台定时同步，全部前台驱动（启动、登录、训练完成、手动按钮）。

```text
用户操作（训练 / 查看）
  ↓
本地 SQLite 立即读写（毫秒级，离线可用）
  ↓
写入 local_sync_queue
  ↓
触发同步（开 App / 训后 / 登录 / 手动）
  ↓
  ├── 1. STRUCTURE PULL（仅 fullPull）GET /sync/groups-pull
  │     先恢复小组 / 成员 / 成员资料身份结构
  ├── 2. DATA PULL（先拉）GET /sync/pull?since=账号级游标
  │     增量拉取服务端变更 → upsertFromServer（仅当前账号云端记录可恢复旧错误归属）
  └── 3. PUSH（后推）POST /sync/push
        批量推送本地变更 → 更新 remote_id / version
```

### 为什么不用其他方案

| 方案 | 适不适合 | 原因 |
|------|----------|------|
| 纯云端为主 | 不适合 | 健身房信号差，离线必须能训练 |
| CRDT 对等同步 | 过度设计 | 健身 App 非实时协作场景，无需字段级无冲突合并 |
| 本地优先 + 云端权威 | 最合适 | 离线可用 + 云端做版本仲裁和数据恢复源 + LWW 冲突策略简单 |

## 2. 同步时机

全部前台驱动，不使用后台定时任务。

| 触发点 | 同步动作 | 实现位置 |
|--------|----------|----------|
| App 启动 / 从后台回前台 | pull → push（30 秒节流） | `app/_layout.tsx` 的 `triggerAppSync()` |
| 登录成功 / 切换账号 | 小组结构全量 pull → 业务数据全量 pull → push | `store/authStore.ts` 的 `sync({ fullPull: true })` |
| 训练完成 | push 优先 | 调用 `syncOrchestrator.syncAfterWorkout()` |
| 数据修改（非训练） | 防抖 3 秒触发 pull → push | 调用 `syncOrchestrator.scheduleSyncDebounced()` |
| 手动点击同步按钮 | pull → push | 设置页同步按钮（保留用于测试） |

### 数据修改的自动同步策略

非训练数据的修改（编辑计划、修改体测、更新成员资料等）通过防抖机制自动同步：

- 每次修改入队 `local_sync_queue` 后，调用 `scheduleSyncDebounced(3000)`。
- 3 秒内如有新的修改，取消前一个定时器，重新计时。
- 3 秒内无新修改，触发 `sync()`（pull → push）。
- 这样连续编辑只触发一次同步，避免过度请求。

训练完成则立即触发 `syncAfterWorkout()`（push 优先），确保训练数据第一时间上云。

## 3. 同步流程详解

### 3.1 Pull（拉取）

文件：`src/sync/pullService.ts`

```text
pullFromServer(fullPull?)
  ├── 1. 读取 sync_state.last_pull_at:{currentUserId}
  │     fullPull=true 或无记录 → since = null（全量）
  │     否则 → since = 当前账号 last_pull_at（增量）
  ├── 2. GET /sync/pull?since={since}&deviceId=liftmark-mobile
  │     返回 { serverTime, changes: { workoutSessions, ... } }
  ├── 3. 按依赖顺序应用 changes：
  │     exercises → trainingPlans → planDays → planExercises →
  │     workoutSessions → workoutExerciseRecords → workoutSets → bodyMetrics
  ├── 4. 每条记录 upsertFromServer：
  │     本地不存在 → INSERT（设 owner_user_id = currentUserId）
  │     remote_id 命中 → UPDATE 当前记录
  │     local id 命中但 owner_user_id 错误 → 以当前账号云端记录重新认领
  │     本地存在且 sync_status='synced' → UPDATE 并保持当前账号归属
  │     本地存在且有未同步修改 → LWW 冲突解决
  └── 5. 全部步骤成功后更新 sync_state.last_pull_at:{currentUserId} = serverTime
        任一步应用失败则不推进游标，下次继续重试
```

### 3.2 Push（推送）

文件：`src/sync/syncService.ts`（已有，`requestImmediateSync`）

```text
requestImmediateSync()
  ├── 1. 从 local_sync_queue 批量取出 pending 记录
  ├── 2. hydrateItemPayload：按 entityType 从本地业务表 SELECT * 读取完整行，
  │     补全队列 payload 中缺失的业务字段（plan_id / type / start_week 等）。
  │     背景：enqueueSyncCandidate 入队时大多未携带业务字段（仅 localId/owner），
  │     若直接用空 payload 推送，服务器 payload 会缺少业务列，
  │     fullPull 时客户端无法恢复 → 本地 plan_phases.plan_id 为空 → plan_has_no_phases。
  │     映射表：localSyncEntityTableByType（plan_phases→plan_phases、plan_days→plan_days 等）。
  ├── 3. 按 entity_type 分组，POST /sync/push { changes, deviceId }
  ├── 4. 服务端逐条 upsert，返回 mappings（clientId → serverId）
  └── 5. 对 success 更新 remote_id、sync_status='synced'
         同时回写业务实体表的 remote_id / sync_status / last_synced_at
         对 failure 标记 sync_status='sync_failed'
```

### 3.3 冲突解决：LWW（Last-Write-Wins）

健身数据以新增为主（每次训练产生新记录），同一记录多设备并发编辑极少。LWW 策略足够可靠。

| 场景 | 处理 |
|------|------|
| 本地干净 + 服务端有更新 | 直接应用服务端数据 |
| 本地有未同步修改 + 服务端无更新 | 本地保持，push 时上传 |
| 本地有未同步修改 + 服务端也有更新（真冲突） | 比较 `updated_at`，新的胜出 |
| 新建操作 | 无冲突，服务端分配新 ID |
| 删除 vs 编辑 | `deleted_at` 非空视为一种字段值，同样适用 LWW |

## 4. owner_user_id 归属约束

三层防护确保数据归属不被篡改：

1. **Repository 层**：INSERT 时设 `owner_user_id = currentUserId`；UPDATE 语句中永远不包含 `owner_user_id` 字段。
2. **accountScope 层**：运行时作用域锁定当前用户，所有操作自动归属该用户。
3. **Pull 恢复例外**：`/sync/pull` 返回的是当前登录账号的云端权威记录。若本地存在同 id / remote_id 但 `owner_user_id` 被旧版本错误写成其他账号，pull 会把该记录重新认领为当前账号，用于恢复 176 这类历史串号数据。

`ownershipRepairService` 只修复 `groups`、`group_members`、`member_profiles` 身份结构表。训练、计划、体测等业务数据不能再按小组 owner 批量改归属，只能由当前账号自己的云端记录在 `/sync/pull` 中认领。

## 5. 同步状态表

`sync_state` 表（migration 17 新增）记录同步游标：

| 列 | 说明 |
|----|------|
| `id` | 主键 |
| `key` | 唯一键（如 `last_pull_at:{userId}`） |
| `value` | 值（ISO 时间戳） |
| `updated_at` | 更新时间 |

## 6. 涉及文件

| 文件 | 角色 |
|------|------|
| `src/sync/pullService.ts` | Pull 服务：从 /sync/pull 拉取并 upsertFromServer |
| `src/sync/syncOrchestrator.ts` | 同步入口：pull → push，防重入，防抖，节流 |
| `src/sync/syncService.ts` | Push 服务：requestImmediateSync 推送本地变更 |
| `src/sync/syncQueue.ts` | 同步队列管理：enqueue、listPending、markSynced |
| `src/data/local/migrations.ts` | migration 16（归属修复）+ migration 17（sync_state 表） |
| `src/data/local/accountScope.ts` | 账号作用域过滤 |
| `src/store/authStore.ts` | 登录后触发 sync({ fullPull: true }) |
| `app/_layout.tsx` | App 启动 / 回前台触发 sync()，30 秒节流 |
| `src/services/ownershipRepairService.ts` | 登录后归属修复（云端反查） |
| `src/services/profileSyncService.ts` | 小组/成员结构同步（pullGroupsAndMembers） |

## 7. 分阶段实施

### P0（已完成）—— 止血：数据丢失/无法恢复

- 实现 pull（补齐下载同步）
- owner_user_id 归属保护
- App 启动 + 登录自动同步
- 记录账号级同步游标 `last_pull_at:{userId}`
- 数据修改防抖自动同步
- 训练完成立即 push
- 登录 fullPull 先拉 `/sync/groups-pull`，再拉 `/sync/pull`
- 旧版本误归属的业务数据可通过当前账号云端记录重新认领
- 停止 App 启动时自动上传本地小组结构，避免把旧本地脏数据绑定到新账号
- Push 成功后回写业务实体的 `remote_id` / `sync_status` / `last_synced_at`

### P1（规划中）—— 无感：物理隔离 + 冲突解决

- 物理分库 `liftmark_{userId}.db`
- LWW 冲突解决（version + updated_at）
- 同步状态 UI
- Push 批量优化 + 失败重试

### P2（规划中）—— 完善：删除同步 + 大数据量

- Tombstone 删除同步
- 分页 pull（大数据量用户首次全量拉取不卡）
- 多设备感知
- 同步诊断面板

## 8. 服务端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/sync/push` | POST | 推送本地变更到云端 |
| `/sync/pull` | GET | 拉取云端变更（支持 since 增量） |
| `/sync/status` | GET | 查询同步状态 |
| `/sync/groups-pull` | GET | 拉取小组和成员结构 |
| `/sync/groups` | POST | 推送小组结构 |
| `/sync/members` | POST | 推送成员信息 |
| `/sync/avatar` | POST | 上传头像 |

## 9. 注意事项

- **部署顺序**：先更新服务器后端，再发布 App。App 依赖服务端 `/sync/pull` 返回的数据格式。
- **首次全量 Pull**：新设备登录时 `fullPull=true`，从 epoch 拉取全部数据。数据量大时可能较慢，P2 阶段加入分页优化。
- **账号恢复操作**：需要恢复 176 账号时，先登录 176 并触发一次 fullPull；不要先登录 188 做结构上传。旧版本误显示在 188 下的 176 记录，会在 176 的云端记录被拉回时重新认领。
- **Pull 时的外键依赖**：必须按 `exercises → plans → planDays → planExercises → workoutSessions → ...` 顺序应用，保证子表 upsert 时能找到父表的 remote_id 映射。
- **同步队列持久性**：`local_sync_queue` 在 SQLite 中，App 重启后不丢失。push 失败的记录不会被清理，只在服务端确认 success 后才标记 synced。
