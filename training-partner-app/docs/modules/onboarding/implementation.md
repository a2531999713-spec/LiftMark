# Onboarding 模块实现文档

更新时间：2026-07-15

## 当前实现

- `app/_layout.tsx` 在登录完成后跳转到 `/onboarding/training-profile`。
- `app/onboarding/training-profile.tsx` 使用单页 step 状态承载四步流程。
- 用户资料写入默认小组第一位成员；如果还没有成员，则创建 owner 成员。
- `recommendPlans()` 接收训练信息和 `listSystemTrainingSchemes()`，返回按得分排序的推荐计划。
- 推荐卡可在全屏 `AppModalSheet` 中复用 `SystemSchemeDetailContent` 查看完整模板；关闭后不重建 route，所有表单草稿保留。
- 点击使用计划调用 `PlanRepository.copySystemSchemeToUserPlan()`，再调用 `activateTrainingPlanForGroup()` 设置当前计划并保证活动周期。

## 边界

- 不新增 SQLite schema。
- 不把系统方案直接设为当前计划。
- 推荐逻辑保持在 domain 层，不写入页面组件。
- 旧四练模板不作为推荐候选。
