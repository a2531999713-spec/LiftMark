# Training Record 模块实现文档

更新时间：2026-06-14

## 本次实现

- `app/(tabs)/history.tsx` 默认选择默认小组的第一个本地成员作为当前成员，并只统计该成员数据。
- `app/(tabs)/history.tsx` 已按 `docs/ui/record-page-redesign.png` 重做基础信息架构：顶部单日历入口、个人概览深色卡、紧凑 2x2 指标、基础趋势条、可点击周历、月视图和紧凑训练列表。
- 新增“我的数据 / 小组汇总”分段切换。
- “小组汇总”当前显示开发中说明，不混用个人统计。
- `app/history/manual.tsx` 补录训练支持间歇秒留空。
- `src/domain/history/history-analysis.ts` 将估算 1RM 限制为重量 > 0 且次数 1-12。

## 数据加载

- 记录页通过 `workoutRepository.listSessions({ groupId, memberId })` 获取当前成员相关 session。
- 详情加载后再按 `set.memberId === currentMember.id` 过滤个人 set。
- 周训练量、周训练次数和周完成组数均从过滤后的个人 set 聚合。

## 快照原则

- 历史训练详情读取 `workout_sessions`、`workout_exercise_records` 和 `workout_sets`。
- 新增的 `planned_rest_seconds` 属于训练动作记录快照。
- 后续计划或动作修改不应影响旧训练记录展示。

## 风险与后续

- 当前成员选择仍是默认小组的第一个成员；后续可加入显式成员切换。
- 小组汇总后续需要单独计算所有本地成员汇总，不得复用个人数据。
- 训练密度、复杂疲劳分析和高级图表后续再做。
