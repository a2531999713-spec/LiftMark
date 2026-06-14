# 训练执行流程

更新时间：2026-06-09

## 1. 流程目标

从今日训练创建 session，并在训练现场多人按动作轮换记录每组完成情况。

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

1. 用户在今日训练页点击开始训练。
2. 调用 `WorkoutRepository.createSessionFromTodayPlan` 创建或复用当天 draft/in_progress session。
3. 根据今日过滤后的 `planExerciseIds` 创建 `workout_exercise_records`，保存计划动作快照。
4. 按每个动作的 sets 和每个成员创建 `workout_sets`，每个成员每组独立保存 planned/actual 字段。
5. 进入 app/workout/[sessionId].tsx。
6. 默认按动作轮换展示；当前动作下按成员展示 set 卡片，不做 Excel 表格。
7. 用户用大按钮 stepper 调整实际重量、次数，并用快捷按钮输入 RPE/RIR。
8. 每次修改立即调用 `WorkoutRepository.saveSet` 保存 SQLite。
9. 用户可上一个动作、下一个动作或完成训练；动作替换和跳过动作留到后续 Sprint。

## 5. 数据读写

写入或重点影响：

- workout_sessions
- workout_exercise_records
- workout_sets

## 6. 异常与边界

- 中途退出再进入必须能恢复。
- 训练中不能要求频繁键盘输入。
- 同一天重复从今日训练进入时，应复用未完成 session，避免重复生成 set。
- 训练执行页显示的计划内容来自 `workout_exercise_records` 快照，避免计划模板后续变化破坏历史。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
