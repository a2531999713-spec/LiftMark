# Weight 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 1RM 100kg，75%，2.5kg increment -> 75kg。
- 1RM 102kg，75%，2.5kg increment -> 77.5kg。
- 1RM 80kg，72.5%，2.5kg increment 的取整策略需明确。
- 杠铃动作按成员杠铃加重单位取整，哑铃动作按成员哑铃加重单位取整。
- percentage 动作缺少对应 1RM 时返回 `missing_1rm`，手动动作返回 `manual`。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：member, plan, exercise。
- 与被依赖模块联调：today-training-flow, workout, history, progression。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 1RM 100kg，75%，2.5kg increment -> 75kg。
- 1RM 102kg，75%，2.5kg increment -> 77.5kg。
- 1RM 80kg，72.5%，2.5kg increment 的取整策略需明确。
- 引体参考总负重缺失时，按体重作为 fallback 生成建议值。

## 5. 边界场景

- 1RM 缺失时必须返回可解释状态，而不是 NaN。
- round 策略会影响 57.5kg 或 60kg 等边界，需要人工确认。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/weight.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
