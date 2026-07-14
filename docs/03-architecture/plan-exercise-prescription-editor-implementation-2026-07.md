# v2.7 训练计划动作处方编辑器

日期：2026-07-14

## 范围

计划编辑统一使用 `PlanEditOverview`、`planEditDraft` 和 `planEditorValidation`。新建计划不再保留训练日级别的共享组数/次数；每个 `PlanExerciseDraft` 都拥有稳定 `id`、动作、A/B/C 优先级、组数、固定/范围次数、强度、固定重量或 %1RM、参考主项、休息和备注。

`PlanExerciseSettingsSheet` 是动作处方唯一编辑入口。固定重量按用户偏好显示 kg/lb，但 SQLite 中仍保存 kg。RPE/RIR 是旧数据兼容字段：读取旧计划不删除它们，新编辑器不展示也不重新写入。

## 保存与历史边界

- 保存前校验每个训练日和每个动作：组数 1–20、次数 1–100、范围上下界、%1RM 1–100、固定重量 >= 0、休息 0–600 秒、排序和优先级。
- `buildPlanEditDraft()` 按每个 `PlanExercise` 恢复处方；`toUpdateUserPlanInput()` 按每个草稿动作写入 `CreateUserPlanDayInput.exercises`，不再读取数组第一个动作作为默认值。
- 复制动作和训练日均深复制，并生成新的草稿 ID；训练日复制标题追加“副本”。
- 训练开始时把计划 sets/reps/range/%1RM/rest/notes 写入 workout snapshot；`intensityType=fixed` 的重量优先写为每组 `planned_weight`。后续编辑计划不更新已有 workout session、set 或报告。

## 数据与部署

本轮只使用已有 `plan_exercises` 与 workout snapshot 字段，不增加 SQLite migration、PostgreSQL migration、API 契约或服务端部署。未实现 ExerciseIcon、`icon_key` 映射、SVG 或第三方媒体；官方素材和页面目的地确定后再单独排期。
