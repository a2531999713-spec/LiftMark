# Plan 模块实现文档

更新时间：2026-06-30  
对应代码目录：`training-partner-app/`

## 1. 当前实现概览

本次计划模块调整后，系统方案和用户计划分离：

- 系统方案目录位于 `src/domain/plan/systemSchemes.ts`。
- 当前可选系统方案以主流训练计划为主：新手全身、Push Pull Legs、经典四分化、上肢 / 下肢、5x5、减脂保肌、恢复训练和居家哑铃。
- 首次 seed 会生成一份默认用户计划 `plan_user_beginner_full_body_default`，并让默认小组当前计划指向这份用户计划。
- 旧四练模板继续写入本地 seed 用于历史兼容，但 `listSystemTrainingSchemes()` 和 `listUserPlans()` 不再把它作为用户可选计划展示。
- 首次登录后的训练信息完善页使用 `recommendPlans()` 基于目标、频率、经验和器械条件推荐方案，并把用户选择复制为当前用户计划。
- 用户点击“使用此方案”时，Repository 复制系统模板的 phases、days、plan_exercises，生成新的用户计划。
- 导入 `.liftmark.json` 时，页面通过 `planDocumentService` 选择文件并调用 `PlanRepository.importUserPlan()` 写入 SQLite。
- 计划页当前为仪表盘结构：当前计划、执行统计、本周安排、我的计划摘要、计划库入口和计划操作弹层；系统方案只在计划库弹层中展开。
- 用户计划可在“管理全部计划”弹层中删除；系统方案、当前计划和最后一个用户计划会被 Repository 阻止删除。
- 创建计划页接入统一动作选择器，可添加系统动作或快速新建自定义动作。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/plan/plan.types.ts` | `PlanTemplate.source` 增加 `system_copy`、`blank_created`、`duplicated`，并增加 `originSchemeId`。 |
| `src/domain/plan/systemSchemes.ts` | 本地系统方案目录和目标/难度中文 label。 |
| `src/domain/plan/planCopy.ts` | `createUserPlanCopyDraft()` 纯函数，复制系统模板为用户计划草稿。 |
| `src/data/repositories/planRepository.ts` | `PlanRepository` 支持用户计划列表、复制系统方案、导入和删除用户计划。 |
| `src/data/local/repositories/planRepository.ts` | SQLite 实现用户计划列表、系统方案复制、导入、删除和今日训练读取。 |
| `src/data/local/migrations.ts` | v2 `plan_system_scheme_origin` 补 `origin_scheme_id` 并迁移旧默认当前计划。 |
| `src/data/seed/mainstreamPlans.ts` | 主流系统计划 seed 和默认新手全身用户计划复制源。 |
| `src/data/seed/defaultStrengthPlan.ts` | legacy 四练模板 seed，仅用于兼容历史数据。 |
| `src/data/seed/classicPplPlan.ts` | “经典三分化 PPL”系统模板 seed。 |
| `src/data/seed/seedDefaultData.ts` | 写入系统模板和默认用户计划副本。 |
| `src/domain/plan/planRecommendation.ts` | 训练信息到推荐计划的匹配规则。 |
| `src/domain/onboarding/trainingProfile.types.ts` | 首次训练信息表单类型。 |
| `app/(tabs)/plan.tsx` | 计划页展示当前计划仪表盘、本周安排、我的计划管理、计划库入口和收纳式计划操作弹层。 |
| `app/onboarding/training-profile.tsx` | 首次训练信息完善和推荐计划选择流程。 |
| `src/components/ui/MiniLineChart.tsx` | 计划页本周执行趋势使用的轻量折线图。 |
| `app/(tabs)/today.tsx` | 训练页当前计划卡和计划切换弹层。 |
| `app/plan/create.tsx` | 第一版创建计划页面，接入统一动作选择器。 |
| `src/tests/plan.test.ts` | 系统方案复制、PPL 和动作库 seed 测试。 |
| `src/tests/plan-repository.test.ts` | 用户计划删除边界测试。 |

## 3. 关键函数

### listSystemTrainingSchemes

文件：`src/domain/plan/systemSchemes.ts`  
职责：返回本地系统方案目录。目录只包含方案元数据和可用状态，不包含训练记录。

### createUserPlanCopyDraft

文件：`src/domain/plan/planCopy.ts`  
职责：把系统模板的 template、phases、days、plan exercises 复制成新的用户计划草稿，生成新的本地 ID，设置 `source: "system_copy"` 和 `originSchemeId`。

### PlanRepository.listUserPlans

文件：`src/data/local/repositories/planRepository.ts`  
职责：只返回 `source != "system"` 的用户计划，避免系统方案污染“我的计划”。

### PlanRepository.copySystemSchemeToUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：读取系统方案引用的模板计划，复制 phases、days、plan exercises，并写入 SQLite。该方法只生成用户计划，不自动修改训练记录。

### PlanRepository.importUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：将导入计划草稿写入 SQLite，写入 template、phases、days、plan exercises、exercises 和 alternatives，并保证导入结果为用户计划。  
边界：拒绝把 `source: "system"` 的模板作为导入用户计划；不导入训练记录、成员 1RM 或身体数据；不覆盖既有计划；动作按名称复用本机已有动作，缺失动作才写入。

### PlanRepository.deleteUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：删除用户计划的 template、phases、days 和 plan exercises。  
边界：系统方案不能删除；当前计划不能删除；最后一个用户计划不能删除；不删除 `workout_sessions`、`workout_exercise_records` 或 `workout_sets`。

### 训练页计划切换

文件：`app/(tabs)/today.tsx`  
职责：顶部当前计划卡提供“切换计划”按钮，弹层只列出 `listUserPlans()` 返回的用户计划。用户选择后更新当前 group 的 `activePlanId`、`currentWeek`、`currentPhaseType`，并刷新今日训练内容。  
边界：不直接列出或执行系统方案；历史记录继续打开训练时快照。

### PlanRepository.createUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：从创建计划页面生成用户拥有的 `blank_created` 计划，包含一个基础周期、训练日和计划动作。第一版不做完整拖拽编辑器。

### GroupRepository.updateGroup

文件：`src/data/local/repositories/groupRepository.ts`  
职责：计划页把复制出的用户计划设为当前计划时，更新 `groups.active_plan_id`、`current_week` 和 `current_phase_type`。

## 4. 数据结构映射

当前未新增独立 `system_training_schemes` 表。第一版采用：

- `SystemTrainingScheme`：domain 层只读 catalog。
- `UserTrainingPlan`：复用 `plan_templates`，通过 `source != "system"` 判断。
- `originSchemeId`：落在 `plan_templates.origin_scheme_id`。
- `ActivePlan`：复用 `groups.active_plan_id`、`current_week`、`current_phase_type`。

## 5. 文件导入导出

第一版推荐导出 `.liftmark.json`，并预留 `.json`、`.liftmark`、`.liftmark.zip`。导出对象是用户计划，不是系统方案。当前 service 仍输出开放 JSON schema：

```text
format: liftmark-plan
schemaVersion: 1
app: LiftMark
```

## 6. 测试

已覆盖：

- 系统方案目录不展示 legacy 四练方案。
- 系统“Push Pull Legs 三分化计划”存在且引用系统模板 ID。
- 系统“经典四分化增肌计划”存在且引用系统模板 ID，复制后保留四个训练日和 24 个计划动作。
- 主流推荐规则能按新手、增肌 4 天、力量、减脂和居家器械条件命中对应方案。
- 复制系统方案时生成新的用户计划 ID。
- 复制结果 `source` 为 `system_copy`。
- 复制结果记录 `originSchemeId`。
- phases、days、plan exercises 指向新的用户计划结构。
- 导入计划草稿生成 `source: "imported"`、`visibility: "private"`，且不会保留系统方案来源。
- 用户计划删除不会碰训练记录表。
- 系统动作库包含 100+ 个无重名系统动作，覆盖 PPL 和补录常用动作。

## 7. 文档同步记录

- 2026-06-12：系统方案与用户计划分离；计划页新增“系统方案”和“我的计划”；新增 `origin_scheme_id` migration；默认小组当前计划切换到默认用户计划副本。
- 2026-06-12：同步可用性 + UI 落地 Sprint：计划页当前计划改为大图卡风格；创建计划入口接入 `app/plan/create.tsx` 和 `PlanRepository.createUserPlan()`；未完成深层编辑显示统一开发中提示。
- 2026-06-12：同步本地图片资产落地：计划页和创建计划页 Hero 通过 `liftmarkImages.planHero` 使用本地训练计划图片；计划模板、seed、SQLite schema 和 Repository 未变。
- 2026-06-14：新增“经典三分化 PPL”系统模板、导入计划落库、设置/计划页导入入口和训练页用户计划切换弹层。
- 2026-06-15：计划页重做为当前计划仪表盘；新增用户计划删除边界；创建计划接入统一动作选择器；导入计划按动作名称复用本机动作。
- 2026-06-29：计划页本周执行趋势改为折线图；创建、导入、导出和管理全部计划收进计划操作底部弹层，页面不再展示大块计划工具网格。
- 2026-06-30：系统方案目录切换为主流计划库；新增经典四分化增肌计划；计划页系统方案移入计划库弹层；新增训练信息完善与推荐计划流程；默认当前计划改为新手全身训练计划；旧四练仅作为 legacy 数据兼容保留。
