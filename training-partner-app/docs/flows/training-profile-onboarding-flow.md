# 训练资料 Onboarding 流程

更新时间：2026-06-30

## 主流程

1. 登录或离线认证完成后进入 `/onboarding/training-profile`。
2. 用户填写或跳过基础资料。
3. 用户选择训练目标、每周训练天数、经验和器械条件。
4. 用户可选填写深蹲、卧推、硬拉 1RM。
5. 页面调用 `recommendPlans()` 生成主推荐和备选计划。
6. 用户点击使用计划后复制系统方案并设置为当前计划。
7. 跳转今日训练页，今日训练读取新的当前用户计划。

## 数据影响

- 写入或更新 `group_members` 与 `member_profiles`。
- 复制写入 `plan_templates`、`plan_phases`、`plan_days`、`plan_exercises`。
- 更新 `groups.active_plan_id`、`groups.current_week` 和 `groups.current_phase_type`。

