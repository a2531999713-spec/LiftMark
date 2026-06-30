# Workout 测试计划

更新时间：2026-06-15

## 2026-06-30 补充

- 完成本组后有计划休息时，应写入 `actualRestSeconds`；提前跳过休息应覆盖为实际经过秒数。
- RPE 只能保存 1-10 整数；清除 RPE 后不应保留旧值。
- 本组备注应随 `saveSet` 写入 SQLite，并在动作历史中可作为记录上下文保留。
- 训练现场统计应展示时长、容量、完成组数和平均 RPE。
- 休息面板应显示倒计时、建议休息、已休息、下一组和下一位成员。
- 训练中替换动作只更新本次 `workout_exercise_records.exercise_id`，并保留首次 `replaced_from_exercise_id`；不得修改原计划。

## 1. 单元测试范围

- 可以完成一场 2-5 人训练。
- 中途退出再进入，记录仍然存在。
- 每位成员的重量、次数、完成情况 独立保存。
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

- 可以完成一场 2-5 人训练。
- 中途退出再进入，记录仍然存在。
- 每位成员的重量、次数、完成情况 独立保存。
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
- `src/tests/workout-repository.test.ts`：session 创建参数、开放 session 复用、RPE/备注/实际休息保存、替换动作保留原计划动作。
