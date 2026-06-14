# Plan 模块实现文档

更新时间：2026-06-14  
对应代码目录：`training-partner-app/`

## 1. 当前实现概览

本次计划模块调整后，系统方案和用户计划分离：

- 系统方案目录位于 `src/domain/plan/systemSchemes.ts`。
- 完整可用的“四练增力增肌方案”引用 SQLite 中的系统模板 `plan_four_day_strength_hypertrophy`。
- 完整可用的“经典三分化 PPL”引用 SQLite 中的系统模板 `plan_classic_three_day_ppl`。
- 首次 seed 和 migration 会生成一份默认用户计划 `plan_user_four_day_strength_hypertrophy_default`，并让默认小组当前计划指向这份用户计划。
- 用户点击“使用此方案”时，Repository 复制系统模板的 phases、days、plan_exercises，生成新的用户计划。
- 导入 `.liftmark.json` 时，页面通过 `planDocumentService` 选择文件并调用 `PlanRepository.importUserPlan()` 写入 SQLite。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/plan/plan.types.ts` | `PlanTemplate.source` 增加 `system_copy`、`blank_created`、`duplicated`，并增加 `originSchemeId`。 |
| `src/domain/plan/systemSchemes.ts` | 本地系统方案目录和目标/难度中文 label。 |
| `src/domain/plan/planCopy.ts` | `createUserPlanCopyDraft()` 纯函数，复制系统模板为用户计划草稿。 |
| `src/data/repositories/planRepository.ts` | `PlanRepository` 增加 `listUserPlans()` 和 `copySystemSchemeToUserPlan()`。 |
| `src/data/local/repositories/planRepository.ts` | SQLite 实现用户计划列表、系统方案复制和今日训练读取。 |
| `src/data/local/migrations.ts` | v2 `plan_system_scheme_origin` 补 `origin_scheme_id` 并迁移旧默认当前计划。 |
| `src/data/seed/defaultStrengthPlan.ts` | 增加默认用户计划 ID 和四练系统方案 ID 常量。 |
| `src/data/seed/classicPplPlan.ts` | “经典三分化 PPL”系统模板 seed。 |
| `src/data/seed/seedDefaultData.ts` | 写入系统模板和默认用户计划副本。 |
| `app/(tabs)/plan.tsx` | 计划页展示当前计划、我的计划、系统方案、创建计划和导入计划。 |
| `app/(tabs)/today.tsx` | 训练页当前计划卡和计划切换弹层。 |
| `app/plan/create.tsx` | 第一版创建计划页面。 |
| `src/tests/plan.test.ts` | 增加系统方案复制为用户计划草稿测试。 |

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
边界：拒绝把 `source: "system"` 的模板作为导入用户计划；不导入训练记录、成员 1RM 或身体数据；不覆盖既有计划。

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

- 系统四练方案存在且引用系统模板 ID。
- 系统“经典三分化 PPL”存在且引用系统模板 ID。
- 复制系统方案时生成新的用户计划 ID。
- 复制结果 `source` 为 `system_copy`。
- 复制结果记录 `originSchemeId`。
- phases、days、plan exercises 指向新的用户计划结构。
- 导入计划草稿生成 `source: "imported"`、`visibility: "private"`，且不会保留系统方案来源。

## 7. 文档同步记录

- 2026-06-12：系统方案与用户计划分离；计划页新增“系统方案”和“我的计划”；新增 `origin_scheme_id` migration；默认小组当前计划切换到默认用户计划副本。
- 2026-06-12：同步可用性 + UI 落地 Sprint：计划页当前计划改为大图卡风格；创建计划入口接入 `app/plan/create.tsx` 和 `PlanRepository.createUserPlan()`；未完成深层编辑显示统一开发中提示。
- 2026-06-12：同步本地图片资产落地：计划页和创建计划页 Hero 通过 `liftmarkImages.planHero` 使用本地训练计划图片；计划模板、seed、SQLite schema 和 Repository 未变。
- 2026-06-14：新增“经典三分化 PPL”系统模板、导入计划落库、设置/计划页导入入口和训练页用户计划切换弹层。
