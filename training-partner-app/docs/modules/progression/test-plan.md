# Progression 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 全部完成且 RPE 8 -> increase。
- 全部完成且 RPE 9 -> maintain。
- 连续失败 2 次 -> deload。
- 4 组均达上限 -> increase；仍在区间 -> add_reps。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：workout, weight, exercise, member。
- 与被依赖模块联调：history, workout-summary-flow。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 全部完成且 RPE 8 -> increase。
- 全部完成且 RPE 9 -> maintain。
- 连续失败 2 次 -> deload。
- 4 组均达上限 -> increase；仍在区间 -> add_reps。

## 5. 边界场景

- 连续失败次数统计口径需要确认。
- 建议不得覆盖训练者手动记录，只能作为建议保存。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/progression.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
