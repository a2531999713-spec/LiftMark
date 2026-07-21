# Schema 文档入口

SQLite 的规范结构说明位于 [`database/schema.md`](database/schema.md)，实际建表定义位于 `src/data/local/schema.ts`。

## v2.11.0 成就连续性

- 移动端不新增成就表或 migration；本地快照按需从现有 `workout_sessions`、`workout_sets`、`plan_cycles`、`recovery_logs` 聚合。
- PostgreSQL 沿用 `achievement_definitions` 与 `user_achievements`，不新增 schema migration。
- 目录变化通过按 code 幂等 seed 完成；`streak_3_days` 只禁用，旧 definition 与 user achievement 不删除。
- 本地账号范围始终使用非空 `owner_user_id = currentUserId`。

## v2.10.0 恢复状态

- 沿用既有 `recovery_logs`，不新增 migration。
- 一天一条的逻辑范围是当前 `owner_user_id + member_id + date`。
- 同日编辑使用事务 upsert；软删除、同步状态和远端 ID 继续使用现有字段。
