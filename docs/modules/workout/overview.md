# Workout 模块概览

更新时间：2026-06-09

## 1. 模块职责

创建训练 session、生成动作记录和每位成员的 set 记录，支撑训练现场多人轮换记录。

- WorkoutSession、WorkoutExerciseRecord、WorkoutSet。
- 从今日训练生成 session、exercise records、workout sets。
- 训练执行页默认按动作轮换，当前动作下按成员记录 set。
- 每次修改立即保存 SQLite，离开页面后可恢复。

## 2. 非职责

- 不定义计划模板本身。
- 不直接决定进阶建议，只在完成训练后触发 progression。
- 不把训练记录保存到 AsyncStorage。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- group
- member
- plan
- exercise
- weight

## 5. 被依赖模块

- history
- progression
- export

## 6. 主要文件

Sprint 4 已实现训练执行页和 SQLite 即时保存；以下路径按当前实现列出：

| 文件 | 说明 |
|---|---|
| `src/domain/workout/workout.types.ts` | 训练 session、动作记录、set 类型。 |
| `src/domain/workout/workout.service.ts` | set 数量、初始 reps、完成度统计。 |
| `src/domain/workout/workout.validation.ts` | 训练输入校验。 |
| `src/data/local/repositories/workoutRepository.ts` | 训练记录 Repository。 |
| `app/(tabs)/today.tsx` | 从今日训练创建或复用 session 的入口。 |
| `app/workout/[sessionId].tsx` | 训练执行页。 |
| `app/workout/summary/[sessionId].tsx` | 训练总结页。 |

## 7. 核心数据结构

- WorkoutSession
- WorkoutExerciseRecord
- WorkoutSet
- workout_sessions
- workout_exercise_records
- workout_sets

## 8. 修改风险

- 训练现场输入必须低摩擦，不能频繁要求键盘输入。
- 训练进行中退出 App 不能丢 set 记录。
- 计划修改不能回写破坏已完成历史。

## 9. 需要人工确认的问题

- Sprint 4 默认按动作轮换展示，每个动作下按成员卡片记录 set；不是 Excel 表格 UI。
- 动作替换仍待 Sprint 5，实现前不要在执行页改写 `exercise_id`。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
