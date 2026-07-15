# Schema 文档入口

SQLite 的规范结构说明位于 [`database/schema.md`](database/schema.md)，实际建表定义位于 `src/data/local/schema.ts`。

## v2.10.0 恢复状态

- 沿用既有 `recovery_logs`，不新增 migration。
- 一天一条的逻辑范围是当前 `owner_user_id + member_id + date`。
- 同日编辑使用事务 upsert；软删除、同步状态和远端 ID 继续使用现有字段。
