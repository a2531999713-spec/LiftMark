# v2.11.1 训练写入管线与结束性能交接

日期：2026-07-21

## 已完成

- 无界逐输入 Promise chain 已替换为最新 patch 合并的 `WorkoutWriteCoordinator`。
- set 批量保存、批量增删与 session 原子结束已进入 SQLite Repository；本地写入先于云端且不依赖网络。
- 同步候选移出输入/结束关键路径，支持 owner-scoped 批量去重和由 `sync_status` 恢复。
- 报告、progression、achievement 和即时同步在总结页路由后隔离执行。
- 执行状态机、同步 ref 锁、返回语义、真实 set 进度、自重校验和多人批量调整已稳定化。

## 数据与部署

- SQLite migration：无。
- PostgreSQL migration / API / shared：无修改。
- 服务器部署：本轮不需要，也未执行。
- 176 数据：未读取或写入业务训练数据库；未删除、迁移或改 owner。
- 设备基准使用可删除的独立 debug 数据库，未打开 `training_partner.db`。

## 验证

- typecheck、lint 通过。
- Jest 58 suites / 293 tests 通过。
- Android arm64 release build 通过。
- NE2210 15 / 64 / 200 set 原子结束分别为 21.913 / 73.742 / 210.561ms；完成本组均低于 8ms，批量调整均低于 6ms。

## 尚需人工验收

使用 188 或新的隔离账号走完整 UI：正常训练、保存退出再继续、断网结束、重启恢复、恢复网络上传、总结/报告/progression/achievement 刷新与无重复 session/set/queue。不要使用 176 执行会写数据的验收。

v2.11.0 的 API 与 seed 仍须在本分支合并并完成上述训练主链人工验收后统一部署。
