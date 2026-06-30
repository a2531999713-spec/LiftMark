# 动作替换流程

更新时间：2026-06-30

## 1. 流程目标

器械被占或身体不适时，使用同模式替代动作，同时保留原计划动作。

## 2. 参与模块

- exercise
- workout
- history

## 3. 前置条件

- 本地 SQLite 可用。
- 默认 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 用户在训练执行页点击替换动作。
2. 根据当前 `exercise_id` 读取 `exercise_alternatives`，并加载完整动作库。
3. 弹层优先展示推荐替代动作；没有替代动作时仍可搜索完整动作库。
4. 如当前动作已有完成组，先提示“替换只影响本次训练，历史分析按替换后动作统计”。
5. 用户选择替代动作。
6. 调用 `WorkoutRepository.updateExerciseRecordExercise(recordId, newExerciseId)`。
7. Repository 更新 `workout_exercise_records.exercise_id`，并使用 `COALESCE(replaced_from_exercise_id, exercise_id)` 保留首次原计划动作。
8. 返回训练执行页，当前动作卡、器械加重单位和后续记录使用新动作。

## 5. 数据读写

写入或重点影响：

- workout_exercise_records
- exercises
- exercise_alternatives

## 6. 异常与边界

- 无替代动作时展示完整动作库搜索，不伪造推荐数据。
- 替代不得修改原始 plan_exercises。
- 已有完成组时本期允许确认后继续替换；完成组仍属于同一训练动作记录，历史详情会展示原动作 -> 实际动作关系。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
