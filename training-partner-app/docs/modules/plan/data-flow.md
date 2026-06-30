# Plan 模块数据流

更新时间：2026-06-12

## 1. 系统方案到用户计划

```text
src/domain/plan/systemSchemes.ts
  -> 用户在计划页点击“使用此方案”
  -> PlanRepository.copySystemSchemeToUserPlan
  -> 读取系统模板 plan_templates / plan_phases / plan_days / plan_exercises
  -> createUserPlanCopyDraft 生成新 ID
  -> 写入用户计划 source=system_copy, origin_scheme_id=scheme_id
  -> 用户可选择设为当前计划
  -> groups.active_plan_id 指向用户计划
```

## 2. 今日训练

```text
groups.active_plan_id
  -> PlanRepository.getTodayPlan
  -> 读取用户计划 phases/days/exercises
  -> recovery 过滤 A/B/C
  -> weight 模块按成员 1RM 计算建议重量
  -> workout 创建 session 和训练快照
```

训练页不得读取系统方案 ID。训练记录不得直接绑定系统方案。

## 3. 导出计划

```text
用户计划 plan_id
  -> createCurrentPlanFile
  -> 读取 template/phases/days/planExercises
  -> 读取相关 Exercise 和 ExerciseAlternative
  -> 生成 liftmark-plan JSON
```

导出不包含训练记录、成员 1RM、身体数据、激活码或设备信息。

## 4. 导入计划

```text
.json / .liftmark.json / .liftmark
  -> parsePlanFile
  -> validatePlanFile
  -> createImportedPlanDraft
  -> 重新生成本地 ID
  -> 后续落库为 source=imported 的用户计划
```

导入不能覆盖已有计划。
