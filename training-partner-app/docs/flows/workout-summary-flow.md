# 训练总结流程

更新时间：2026-06-08

## 1. 流程目标

训练完成后统计完成度、成员完成情况、PR/预估 1RM 和下次建议。

## 2. 参与模块

- workout
- progression
- history
- weight

## 3. 前置条件

- 本地 SQLite 可用。
- 默认 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 用户点击完成训练。
2. 更新 workout_session.status=completed 并写入 finished_at。
3. 统计每个成员和每个动作的完成情况。
4. 调用 progression 模块生成 progression_suggestions。
5. 计算 PR 或预估 1RM 展示项。
6. 跳转训练总结页。
7. 总结页展示未完成动作和下次建议。

## 5. 数据读写

写入或重点影响：

- workout_sessions
- progression_suggestions

## 6. 异常与边界

- 未完成 set 应保留未完成状态。
- 建议只能追加保存，不能覆盖训练记录。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
