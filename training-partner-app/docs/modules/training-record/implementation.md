# Training Record 模块实现文档

更新时间：2026-07-07

## 2026-07-07 补充：当前小组作用域与补录空草稿

- 记录首页、个人分析、小组分析、动作对比、出勤率和成员分析均通过 `selectedGroupStore.selectedGroupId` 解析当前小组；选中小组不存在时回落到第一个可见小组。
- 新增 `src/domain/group/selected-group.ts`，统一封装“选中小组优先、失效回落”的逻辑，避免页面继续直接读取默认小组。
- `app/history/manual.tsx` 补录入口不再内置“胸背补录”、卧推/划船/下压等参考图示例动作，也不再预填示例重量和次数。
- 补录模式明确为“个人补录”和“小组补录”；“关联计划”改为可点击选择器，作为历史记录来源标记，不会修改当前计划。
- `app/history/manual-set-editor.tsx` 隐藏默认路由头部，页面不再显示硬编码“卧推组数据”标题。

## 本次实现

- `app/(tabs)/history.tsx` 默认选择当前小组的第一个本地成员作为当前成员，并只统计该成员数据。
- `app/(tabs)/history.tsx` 已按 `docs/ui/record-page-redesign.png` 重做基础信息架构：顶部单日历入口、个人概览深色卡、紧凑 2x2 指标、基础趋势条、可点击周历、月视图和紧凑训练列表。
- 新增“我的数据 / 小组汇总”分段切换。
- “小组汇总”当前显示开发中说明，不混用个人统计。
- `app/history/manual.tsx` 补录训练支持空草稿、个人/小组补录切换和计划来源选择。
- `src/domain/history/history-analysis.ts` 将估算 1RM 限制为重量 > 0 且次数 1-12。

## 数据加载

- 记录页通过 `selectedGroupStore` 解析当前 `groupId`，再用 `workoutRepository.listSessions({ groupId, memberId })` 获取当前成员相关 session。
- 详情加载后再按 `set.memberId === currentMember.id` 过滤个人 set。
- 周训练量、周训练次数和周完成组数均从过滤后的个人 set 聚合。

## 快照原则

- 历史训练详情读取 `workout_sessions`、`workout_exercise_records` 和 `workout_sets`。
- 新增的 `planned_rest_seconds` 属于训练动作记录快照。
- 后续计划或动作修改不应影响旧训练记录展示。

## 风险与后续

- 当前成员选择仍是当前小组的第一个成员；后续可加入显式成员切换。
- 小组汇总后续需要单独计算所有本地成员汇总，不得复用个人数据。
- 训练密度、复杂疲劳分析和高级图表后续再做。
