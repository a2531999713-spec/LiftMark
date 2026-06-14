# Plan 模块概览

更新时间：2026-06-12

## 1. 模块职责

Plan 模块负责区分并管理两类对象：

- 系统方案 `SystemTrainingScheme`：系统提供的只读训练方案库，用于查看、预览和复制，不直接执行训练，不直接绑定训练记录。
- 用户计划 `UserTrainingPlan`：用户真正使用、可编辑、可导出、可设为当前计划的本地计划，落在现有 `plan_templates`、`plan_phases`、`plan_days`、`plan_exercises` 数据结构中。

正确流程是：

```text
系统方案库 -> 查看方案详情 -> 使用此方案 -> 复制生成用户计划 -> 设为当前计划 -> 训练记录绑定用户计划或训练时快照
```

## 2. 非职责

- 不保存实际训练完成情况。
- 不保存成员个人 1RM。
- 不把系统方案直接放进“我的计划”。
- 不在 React 页面组件中硬编码训练日和动作细节。

## 3. 相关业务场景

- 系统方案复制为我的计划。
- 从空白创建计划。
- 导入 `.json` / `.liftmark.json` / `.liftmark` 计划文件。
- 当前计划周数、阶段和周五补弱设置。
- 今日训练读取当前用户计划。
- 训练记录保存用户计划 ID 和训练时动作快照。

## 4. 依赖模块

- exercise
- group
- recovery
- export

## 5. 被依赖模块

- workout
- weight
- progression
- history

## 6. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/plan/plan.types.ts` | 计划模板、阶段、训练日、计划动作类型，`PlanTemplate.source` 区分 system/system_copy/imported 等来源。 |
| `src/domain/plan/systemSchemes.ts` | 本地系统方案目录，包含标题、目标、难度、频率、标签、可用状态和系统模板 planId。 |
| `src/domain/plan/planCopy.ts` | 把系统模板复制成用户计划草稿的纯函数。 |
| `src/data/local/migrations.ts` | v2 增加 `origin_scheme_id`，并把旧默认系统计划迁移为用户计划副本。 |
| `src/data/seed/seedDefaultData.ts` | 首次启动写入系统方案模板和默认用户计划副本。 |
| `src/data/local/repositories/planRepository.ts` | 本地计划 Repository，支持用户计划列表、复制系统方案、今日训练读取。 |
| `app/(tabs)/plan.tsx` | 计划页：当前计划、我的计划、系统方案、创建计划和导入计划入口。 |
| `src/services/planFileService.ts` | 计划文件生成、校验和导入 ID 重映射。 |

## 7. 核心数据结构

- SystemTrainingScheme
- UserTrainingPlan（现阶段复用 PlanTemplate + source/originSchemeId）
- ActivePlan（现阶段由 `groups.active_plan_id`、`current_week`、`current_phase_type` 表达）
- TrainingRecord（`workout_sessions.plan_id` 只能指向用户计划或训练时计划快照）

## 8. 修改风险

- 系统方案直接成为当前计划，会污染用户“我的计划”和训练记录边界。
- 删除用户计划前需要确认，未来建议采用软删除。
- 修改系统方案 seed 时，不能自动覆盖用户已复制出的计划。
