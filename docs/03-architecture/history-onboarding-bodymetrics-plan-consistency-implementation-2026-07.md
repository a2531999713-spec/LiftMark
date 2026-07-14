# v2.7.2 记录、引导、身体数据与计划一致性

## 修复范围

- 记录首页恢复内容优先的个人训练趋势与小组洞察；洞察完全来自当前账号、小组、日期范围和筛选后的训练项。
- 登录后不再无条件进入训练资料页。每个账号单独保存 `training_onboarding_status:{userId}`，已完成、已跳过、已有成员档案或计划时直接进入首页。
- 身体数据入口迁到“我的”。保存当天体重继续 upsert `body_metrics`，仅当该记录不早于既有最新记录时同步更新 `member_profiles.bodyweight` 并进入同步队列。
- 首页统计、上次表现、计划进度和最近训练都只认 `workout_sessions.status='completed'` 且有有效完成组的 session。

## 数据与部署

没有新增 SQLite migration、PostgreSQL migration、API 契约或服务器部署。所有查询继续使用 owner 与 group 作用域。

## 已知限制

计划页的完整 ActiveTrainingContext 收敛和专用 completed-session 聚合 repository 仍应作为后续小范围改进完成；本轮已先阻止未完成 session 进入其最近训练统计。
