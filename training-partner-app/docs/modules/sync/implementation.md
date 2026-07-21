# Sync 模块实现文档

## 2026-07-21 v2.11.1 workout queue batching

- 训练输入只先写业务 SQLite 表并维护 `sync_status`，不为每个键盘事件立即写同步队列。
- `enqueueSyncCandidatesBatch` 按 owner/type/localId 去重，delete 优先，一次读取当前账号和活动队列，在一个事务中 upsert。
- 已知 owner 必须由调用方传入；跨账号候选直接跳过，绝不合并。
- 重复活动队列行保留按 `created_at DESC` 读取的最新项，其余安全标记 synced；未新增 UNIQUE migration。
- `reconcileDirtyWorkoutSyncQueue` 从当前账号的 dirty workout session/record/set 重建候选，是异常退出后的恢复路径。
- 报告、进阶、成就、队列重建和网络 push 在训练总结路由后调度，彼此失败隔离。
