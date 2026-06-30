# Recovery 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 高分 -> normal。
- 中等 -> remove_c。
- 较低 -> only_a。
- 关节痛高 -> only_a / bad。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：member, plan。
- 与被依赖模块联调：today-training-flow, workout, progression。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 高分 -> normal。
- 中等 -> remove_c。
- 较低 -> only_a。
- 关节痛高 -> only_a / bad。

## 5. 边界场景

- 关节不适高分应优先休息或只做 A，不能硬推训练。
- 恢复评分输入可能缺失，今日训练应有默认模式。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/recovery.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
