# 训练执行流程

更新时间：2026-06-30

## 1. 流程目标

从今日训练创建 session，并按本次参与成员在训练现场轮换记录每组完成情况。

## 2. 参与模块

- workout
- member
- plan
- exercise
- weight

## 3. 前置条件

- 本地 SQLite 可用。
- 默认 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 用户在今日训练页点击开始训练，并选择 `solo_local` 或 `group_local` 记录范围。
2. 用户确认本次参与成员。
3. 调用 `WorkoutRepository.createSessionFromTodayPlan` 创建或复用同计划、同周次、同训练日、同记录模式的 draft/in_progress session。
4. Repository 必须使用调用方传入的 `week` 和 `weekday` 查询 `plan_days` 并写入 `workout_sessions`，不得回退到 `groups.current_week`。
5. 根据当前计划、周次、训练日和动作筛选过滤后的 `planExerciseIds` 创建 `workout_exercise_records`，保存计划动作快照。
6. 按每个动作的 sets 和参与成员创建 `workout_sets`，每个参与成员每组独立保存 planned/actual 字段。
7. 进入 app/workout/[sessionId].tsx。
8. 执行页按 session sets 反推参与成员，只展示本次参与者。
9. 默认按动作轮换展示；当前动作下按参与成员展示 set 卡片，不做 Excel 表格。
10. 用户用大按钮 stepper 调整实际重量、次数；RPE / 备注作为可选高级记录折叠展示，RPE 展开后横向滑动选择 1-10。
11. 每次修改立即调用 `WorkoutRepository.saveSet` 保存 SQLite。
12. 用户完成一组后，如存在计划休息时间，进入休息面板并显示倒计时、建议休息、已休息、下一组和下一位成员；点击“提前开始下一组”或“开始下一组”时写入实际休息秒数。
13. 用户可上一个动作、下一个动作、替换当前动作或完成训练。
14. 替换当前动作只更新本次 `workout_exercise_records.exercise_id`，并保留 `replaced_from_exercise_id`，不修改原计划。

## 5. 数据读写

写入或重点影响：

- workout_sessions
- workout_exercise_records
- workout_sets

## 6. 异常与边界

- 中途退出再进入必须能恢复。
- 训练中不能要求频繁键盘输入。
- 同一天重复从今日训练进入时，应复用未完成 session，避免重复生成 set。
- 同一天存在不同计划、不同周次、不同训练日或不同记录模式的未完成 session 时，今日训练页必须先让用户选择继续旧训练、放弃旧训练并开始当前选择或返回。
- 训练执行页显示的计划内容来自 `workout_exercise_records` 快照，避免计划模板后续变化破坏历史。
- 未参与成员不生成 `workout_sets`，因此不会出现在执行页、总结页的成员轮换和统计中。
- RPE 不强制填写，也不恢复 RIR 入口。
- 替换动作如已有完成组，需要提示用户替换只影响本次训练；历史和分析按实际 `exercise_id` 统计，同时保留原计划动作信息。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
