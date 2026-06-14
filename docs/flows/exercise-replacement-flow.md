# 动作替换流程

更新时间：2026-06-08

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
2. 根据当前 exercise_id 读取 exercise_alternatives。
3. 展示替代动作、动作模式、注意事项和不建议替代项。
4. 用户选择替代动作。
5. 更新 workout_exercise_record.exercise_id。
6. 写入 replaced_from_exercise_id 保存原计划动作。
7. 返回训练执行页继续记录。

## 5. 数据读写

写入或重点影响：

- workout_exercise_records

## 6. 异常与边界

- 无替代动作时给出空状态。
- 替代不得修改原始 plan_exercises。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
