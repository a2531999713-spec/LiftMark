# LiftMark v2.11.1 训练写入管线与结束性能稳定性

日期：2026-07-21

## 1. 用户现象与修复前基准

训练中的输入次数越多，“完成本组”或“结束训练”的处理时间越长，极端情况下从数秒增长到数分钟。旧服务在 2ms 可控 SQLite 延迟下复现：15 / 64 / 200 set 分别需要 1127 / 4881 / 15197ms；同一 set 连续 500 次输入形成 500 次写入，耗时 7625ms。

## 2. 实际根因

- `WorkoutAutosaveService` 为每次输入追加必须串行完成的 Promise，同一 set 没有固定上界。
- 每个触发的保存约包含 2 次训练表 SQL 和 3 次同步队列 SQL，并重复读取账号、owner 与队列存在性。
- finish 先追加最终 patch，再等待整条历史队列，并在卸载时重复 flush。
- 报告、进阶建议、成就和网络同步曾可能进入结束按钮关键路径。
- 调整操作逐 member / set 保存；React boolean 不能同步阻止双击，异步闭包还可能推进错误 cursor。

`finishSession` 的单次 scoped update 不是主要瓶颈；瓶颈是它之前积压的写链和队列写入。

## 3. WriteCoordinator 与 patch 合并

`WorkoutWriteCoordinator` 取代无界 Promise chain。同一 set 的连续输入按字段合并为最新 patch；任一时刻最多有一个正在写入的 batch 和一个合并后的 next patch。失败快照会恢复到 pending，允许显式重试。`freeze` 在结束开始时禁止新输入，`discardSet` 在软删除 set 后清除过期 patch。

输入事件不再等同于数据库写入。500 次同 set 输入会被合并为有限批次，结束只处理当时仍 dirty 的 set。

## 4. 批量 Repository 与原子结束

新增本地契约：`saveSetPatchesBatch`、`completeSessionAtomic`、`addSetsToExerciseRecordsBatch`、`deleteSetsBatch`。

批量保存只做一次账号/小组 scope 校验和一次目标读取，在一个 SQLite 排他事务中更新全部最终 patch，并同时写 `sync_status`、`sync_error`、`updated_at`。原子结束在同一事务内先写最终 set，再将 session 更新为 `completed`；已完成 session 幂等返回。事务内没有网络、报告、成就或 progression 调用。

## 5. 同步候选解耦与恢复

键盘输入不再立即写 `local_sync_queue`。`enqueueSyncCandidatesBatch` 按 `ownerUserId + entityType + localId` 去重，delete 优先于 update，已知 owner 直接传入，一次读取现有活动行并在一个事务中 upsert。历史重复活动行保留最新项，旧项安全标记为 synced，不增加带风险的 UNIQUE migration。

业务表的 `sync_status` 是崩溃恢复依据。`reconcileDirtyWorkoutSyncQueue({ sessionId? })` 可按当前账号从 dirty session / record / set 重建队列，因此“本地已保存、队列尚未写入时退出”不会永久丢失云同步机会。

## 6. 结束关键路径与后置任务

关键路径收敛为：同步 ref 锁 → freeze → 清除 debounce timer → 等当前实际写入 → 取得最终合并 patch → `completeSessionAtomic` → 跳转总结页。

路由完成后，`schedulePostWorkoutTasks` 相互隔离地调度队列重建、报告、进阶建议、成就与网络同步。任一后置任务失败都不回滚已经完成的本地训练，也不占用结束按钮状态。

## 7. 状态机、返回和进度语义

执行阶段统一为 `loading / active / saving_set / adjusting / closing / completed / save_failed`，finish、complete-set 和 adjustment 另有同步 ref 锁防双击。正常 finish 后 unmount 只释放 timer/listener，不重复 flush；后台仅在 active 且未 finishing 时快照保存。

返回入口明确区分：继续训练；保存并退出（session 保持 `in_progress`，不生成正式报告）；结束训练（原子完成并调度后置任务）；放弃本次仍是独立危险操作。

动作进度从真实 set 状态计算 `completed / current / partial / pending / skipped`，不再由浏览 index 推断。仍有未完成且未 skipped 的 set 时不会伪装为全部完成。

## 8. 完成本组、自重动作和批量调整

完成本组捕获 session / set / record / member / revision，保存结果身份不匹配或失败时不推进 cursor。自重动作允许 0kg，但 reps 必须大于 0；器械动作继续遵循重量校验。

加组、减组、增加参与成员、多人跳过和应用 progression 都改为内存组装后一次 batch。失败时保留调整 Sheet 与本地 dirty 状态，不展示虚假的成功。

## 9. 查询与 migration 审计

查询计划确认 set-by-session 使用 `idx_workout_sets_session_id`，member/exercise 使用 `idx_workout_sets_member_exercise`，批量队列 owner/status 查询使用 `idx_local_sync_queue_owner_status`。现有索引足够，因此没有 SQLite migration、PostgreSQL migration 或 API 变更，也不需要本轮服务器部署。

## 10. 自动化验证

- TypeScript typecheck：通过。
- ESLint：通过。
- Jest：58 suites / 293 tests 通过。
- 覆盖 coordinator 合并/失败恢复、50-set 单事务结束、结束幂等、队列去重/账号隔离/delete 优先/重复行收敛、进度、自重与架构边界。
- arm64 release APK：构建通过。

## 11. NE2210 真机隔离性能结果

使用仅存在于 debug source set 的 receiver 和独立数据库 `workout_write_pipeline_v2111_benchmark.db`；它不打开业务数据库，不启动主页面，结束后删除数据库。结果单位为 ms：

| 场景 | set | 完成本组 | 批量调整 | 原子结束 | 路由后队列 | 关键写入 |
|---|---:|---:|---:|---:|---:|---:|
| A | 15 | 4.548 | 4.537 | 21.913 | 19.766 | 16 |
| B | 64 | 6.275 | 4.499 | 73.742 | 68.935 | 65 |
| C | 200 | 7.727 | 5.045 | 210.561 | 197.700 | 201 |

每个场景只执行一次原子结束；同步候选在路由后按 set 数一次批量处理。结果显著低于普通训练 800ms / 200-set 1500ms 目标，且不随历史输入事件数线性增长。

## 12. 已知限制

- 真机结果验证了 NE2210 上的原生 SQLite 写入、事务与队列批处理，但不是 188 登录账号的完整 UI 手工流程。
- 尚未人工覆盖 188 的保存退出后继续、断网结束、重启恢复、恢复网络上传以及总结页/报告/进阶/成就最终刷新。
- v2.11.0 的 shared/API/seed 仍未部署；本轮没有修改也没有部署服务端。
- debug benchmark receiver 不进入 release manifest，不携带用户标识、训练明细或业务数据库访问。
