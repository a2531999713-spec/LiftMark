# Group 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 首次启动可以创建默认小组。
- 能保存当前周期、周数、周五是否训练。
- 切换周数后今日训练读取正确周。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：plan。
- 与被依赖模块联调：member, today-training-flow, workout, export。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 首次启动可以创建默认小组。
- 能保存当前周期、周数、周五是否训练。
- 切换周数后今日训练读取正确周。

## 5. 边界场景

- 第一版即使只有一个默认小组，也不能把 UI 和数据结构做成单人逻辑。
- currentWeek 和 currentPhaseType 必须与 plan phase 范围保持一致。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/group.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
