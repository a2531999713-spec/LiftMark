# v2.11.0 训练连续性与成就中心交接

日期：2026-07-21

## 已完成

- shared 11 项稳定目录与 DTO。
- 移动端 Monday-week 引擎、SQLite scoped 聚合、离线优先/远端单调 merge。
- 首页连续性卡、`/achievements`、AccountPanel 入口、训练总结新解锁 Sheet。
- API 有效训练/组/容量/小组模式/周期/恢复统计修复。
- definitions + existing achievements 固定查询、内存 Map、事务批量 reconcile，消除按成就 N+1。
- idempotent seed；`streak_3_days` 与旧错误别名禁用，所有历史行保留。

## 数据与 migration

- SQLite migration：无。
- PostgreSQL migration：无。
- 176 主账号：未删除、迁移或制造训练历史。
- 188 测试账号：本轮未执行服务器数据修改。
- generic sync：未加入 `user_achievements`。

## 验证

- shared typecheck/build：通过。
- mobile typecheck/lint：通过。
- mobile Jest：55 suites / 275 tests 通过。
- API typecheck/build：通过。
- API 递归 tests：23 通过。
- Android arm64 build/install：通过。
- NE2210 只读验收：首页入口、中心、滚动、返回、无横向溢出通过。
- 未验收：隔离账号实际完成训练、一次性解锁、取消/跳过/断网/恢复写路径；自动化已覆盖核心规则。

## 合并后部署

本分支开发阶段未部署服务器。合并 `master` 后执行 `training-partner-app/docs/backend-deploy-guide.md` 的 v2.11.0 清单：先备份数据库和检查 PM2，再 pull、构建 shared/API、递归测试、`npm run db:seed`、按 `apps/liftmark-api/ecosystem.config.js` reload，最后验证 `/api/health`、`/api/migration-health` 与认证 `/api/achievements/me`。

## 保护与剩余项

- 不删除旧 definition/user achievements，不无条件 DELETE，不改 owner。
- 继续延期排行榜、积分商城、小组挑战、公开成就、PR 成就和动作图标。
- 下一步只应先完成服务器部署与隔离账号验收；通过后再启动下一阶段架构重构。
