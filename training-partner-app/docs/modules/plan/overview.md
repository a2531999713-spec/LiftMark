# Plan 模块概览

更新时间：2026-06-30

## 2026-06-30 主流计划库与推荐

- 系统方案目录当前展示主流计划库：新手全身、Push Pull Legs、经典四分化、上肢 / 下肢、5x5、减脂保肌、恢复训练和居家哑铃。
- 计划页主界面不直接铺开系统方案列表，只提供“计划库”弱入口；用户进入计划库弹层后再预览或使用系统方案。
- 默认用户计划为“新手全身训练计划”；旧四练模板仅用于 legacy 数据兼容，不进入新用户推荐、系统方案列表或训练页切换列表。
- 新增 `recommendPlans()` 和 onboarding 流程，用户填写资料后可复制推荐系统方案并设为当前计划。

## 2026-06-29 计划日临时选择

- 今日训练页支持临时选择当前周和训练日，用于“今天练 Day 1-4 / 补弱 / 自由训练”的现场决策。
- 临时选择只影响首页展示和即将开始的 session，不修改 `groups.current_week` 或当前计划。
- 用户可见入口统一称为“导入计划”；`.liftmark.json` 是文件格式说明，不再作为按钮主文案。

## 2026-06-15 plan-dashboard-exercise-library-custom-exercise-member-limit-weight-git-sprint

- 计划页重做为当前计划仪表盘，默认展示当前计划进度、本周执行、周安排和我的计划摘要。
- “管理全部计划”进入 App 风格底部弹层；用户计划可以删除，但系统方案、当前计划和最后一个用户计划不可删除。
- 计划创建页接入统一动作选择器，支持系统动作和用户自定义动作。
- 导入计划按动作名称复用本机已有动作，缺失动作才写入 SQLite，避免重复导入自定义动作。

## 2026-06-14 settings-history-plan-switch-cleanup-sprint

- 新增完整可用系统方案“经典三分化 PPL”，系统方案只读，用户必须点击“使用此方案”后复制为“我的计划”才能执行。
- 计划页和设置页均支持导入 `.liftmark.json`；导入使用 schema 校验与 ID 重映射，落库后成为 `source: "imported"` 的用户计划。
- 训练页顶部当前计划卡新增“切换计划”入口，只列出“我的计划”，不直接列出系统方案。
- 切换当前计划只更新当前本地小组的 `active_plan_id`、`current_week` 和 `current_phase_type`，不影响历史训练记录。

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
- 从空白创建计划，并通过统一动作选择器添加动作。
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
| `src/data/seed/mainstreamPlans.ts` | 主流系统计划库 seed 和默认新手全身用户计划复制源。 |
| `src/data/seed/classicPplPlan.ts` | Push Pull Legs 三分化系统模板 seed 数据。 |
| `src/domain/plan/planRecommendation.ts` | 基于训练资料返回推荐系统方案。 |
| `app/onboarding/training-profile.tsx` | 新用户训练信息完善和推荐计划选择流程。 |
| `src/domain/plan/planCopy.ts` | 把系统模板复制成用户计划草稿的纯函数。 |
| `src/data/local/migrations.ts` | v2 增加 `origin_scheme_id`，并把旧默认系统计划迁移为用户计划副本。 |
| `src/data/seed/seedDefaultData.ts` | 首次启动写入系统方案模板和默认用户计划副本。 |
| `src/data/local/repositories/planRepository.ts` | 本地计划 Repository，支持用户计划列表、复制系统方案、导入、删除和今日训练读取。 |
| `app/(tabs)/plan.tsx` | 计划页：当前计划仪表盘、本周安排、我的计划管理、计划库入口和计划操作弹层。 |
| `app/(tabs)/today.tsx` | 训练页当前计划卡和“切换计划”弹层，只切换用户计划。 |
| `src/services/planFileService.ts` | 计划文件生成、校验和导入 ID 重映射。 |
| `src/services/planDocumentService.ts` | 文件选择和计划导入草稿生成。 |

## 7. 核心数据结构

- SystemTrainingScheme
- UserTrainingPlan（现阶段复用 PlanTemplate + source/originSchemeId）
- ActivePlan（现阶段由 `groups.active_plan_id`、`current_week`、`current_phase_type` 表达）
- TrainingRecord（`workout_sessions.plan_id` 只能指向用户计划或训练时计划快照）

## 8. 修改风险

- 系统方案直接成为当前计划，会污染用户“我的计划”和训练记录边界。
- 删除用户计划前需要二次确认；当前版本物理删除计划数据但不删除训练记录，未来建议采用软删除。
- 修改系统方案 seed 时，不能自动覆盖用户已复制出的计划。
