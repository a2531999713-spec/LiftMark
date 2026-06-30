# Export 测试计划

更新时间：2026-06-11

## 1. 单元测试范围

- 用户可以导出本地训练数据。
- 导出 JSON 包含成员、计划、训练记录和建议。
- 重置 seed 数据后默认 group 和默认 plan 仍可读取。
- 当前计划 `.liftmark` 导出不包含训练记录或成员 1RM。
- 导入计划校验 schemaVersion，不兼容版本给出中文错误。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：group, member, plan, exercise, workout, progression, recovery。
- 与被依赖模块联调：settings。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 用户可以导出本地训练数据。
- 导出 JSON 包含成员、计划、训练记录和建议。
- 重置 seed 数据后默认 group 和默认 plan 仍可读取。
- 导入计划时生成新的本地 id，避免覆盖已有计划。

## 5. 边界场景

- 导出不能漏掉 workout_sets、progression_suggestions、recovery_logs。
- 重建测试数据必须有确认流程，避免误删真实训练记录。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/plan-file.test.ts`
- `src/tests/export.test.ts` 待 SQLite 集成测试补充。
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
