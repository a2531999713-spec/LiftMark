# Workout 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 可以完成一场 2-4 人训练。
- 中途退出再进入，记录仍然存在。
- 每位成员的重量、次数、RPE/RIR 独立保存。
- set 数量、默认 reps、完成度统计和训练输入边界。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：group, member, plan, exercise, weight。
- 与被依赖模块联调：history, progression, export。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 可以完成一场 2-4 人训练。
- 中途退出再进入，记录仍然存在。
- 每位成员的重量、次数、RPE/RIR 独立保存。
- `saveSet` 每次修改后立即持久化到 SQLite。
- 按动作轮换 UI 下，切换动作不覆盖其他动作或成员 set。
- 同一天重复从今日训练进入时，复用已有 draft/in_progress session。

## 5. 边界场景

- 训练现场输入必须低摩擦，不能频繁要求键盘输入。
- 训练进行中退出 App 不能丢 set 记录。
- 计划修改不能回写破坏已完成历史。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/workout.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。

当前已覆盖：

- `src/tests/workout.test.ts`：set 数量、初始 reps、完成度统计、训练输入边界。
