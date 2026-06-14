# 进阶建议生成流程

更新时间：2026-06-08

## 1. 流程目标

根据训练结果生成加重、维持、降重、减量或继续加次数建议。

## 2. 参与模块

- progression
- workout
- weight
- history

## 3. 前置条件

- 本地 SQLite 可用。
- 默认 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 读取 session 内 workout_sets 和 workout_exercise_records。
2. 识别当前计划阶段：strength、hypertrophy 或 deload。
3. 增力期：根据是否全部完成、top RPE、近期失败次数计算建议。
4. 增肌期：根据每组次数、repMin/repMax、lowest RIR 和动作质量计算建议。
5. 根据成员加重单位生成 suggestedWeight。
6. 写入 progression_suggestions。
7. 历史页和总结页读取最近建议。

## 5. 数据读写

写入或重点影响：

- progression_suggestions

## 6. 异常与边界

- 连续失败次数统计口径待确认。
- 增肌动作变形字段第一版是否记录待确认。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
