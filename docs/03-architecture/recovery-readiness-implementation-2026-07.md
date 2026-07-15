# v2.10.0 恢复状态评估与当日训练调整

更新时间：2026-07-15

## 1. 产品目标

把已有恢复评分、`recovery_logs` 和 A/B/C 过滤变成可使用、可同步、可解释的训练前闭环。恢复状态是可跳过的辅助决策，不是医疗判断，也不能阻塞计划首屏或离线训练。

## 2. 评估项目与计分

六项均为 1–5：睡眠、食欲、训练欲望为正向；肌肉酸痛、关节不适、整体疲劳为负向语义。用户始终看到自然语言档位，不需要理解反向计分。

```text
total = sleep + appetite + motivation
      + (6 - soreness) + (6 - jointPain) + (6 - fatigue)
range = 6..30
```

## 3. 阈值与硬性安全规则

| 结果 | 主要条件 | 建议 |
|---|---|---|
| normal | 25–30，joint/fatigue 不高于 2 | 按原计划 |
| remove_c | 21–24，无更高优先级硬规则 | 保留 A/B |
| reduce_weight | 17–20，或 fatigue/soreness 为 4 | 保留动作，临时降重 |
| only_a | 13–16，或 joint 为 4 | 只保留 A |
| rest | 不高于 12，joint/fatigue 为 5，或明确不适 | 优先恢复 |

判断顺序从安全覆盖到一般阈值。`reasons` 由确定性模板生成，最多三条。UI 不使用“禁止训练”“诊断”等措辞；持续疼痛或明显不适提示停止训练并寻求专业帮助。

## 4. 连续低状态

当前结果与最近两条记录共三条，若 recommendation 均属于 `only_a/reduce_weight/rest` 且平均分低于 17，则当前建议升级为 `deload`。该结果只建议短期减量或恢复日，不修改计划周期。

## 5. Repository、作用域与一天一条

`RecoveryRepository` 暴露 daily get/upsert、member history、latest、trend 和 soft delete。每次调用显式携带 `ownerUserId + memberId`：

1. owner 必须等于当前认证账号。
2. member 必须通过未删除 `group_members -> groups` scoped join 对当前账号可见。
3. 所有读取排除 `deleted_at`。
4. 同日 upsert 在 SQLite 排他事务中按 owner/member/date 查找；新记录使用 `recovery_{owner}_{member}_{date}`，旧记录保留原 ID/createdAt。
5. 本地事务完成后才进入同步队列。

逻辑唯一范围是 owner/member/date；本轮不为旧数据库增加 UNIQUE migration。

## 6. 同步边界

push 复用现有 `recoveryLogs` registry、队列合并和通用 server contract。pull 只接受当前可见小组内 member 的 `id/local_member_id/remote_id` 精确映射，不按昵称或单独 user id 推断；同日远端记录优先复用本地 daily ID。没有 PostgreSQL/API/共享 DTO 变更。

## 7. 今日训练接入

Today 先加载小组、计划和训练内容，再独立异步查询恢复状态。查询失败只把紧凑卡片切换为可重试状态，不能设置首页全局 error。未评估仍可开始；首次点击开始只提示一次“快速评估 / 直接开始”，直接开始后本页面会话不重复弹出。

## 8. 动作筛选与 session 调整

- normal：完整动作。
- remove_c：在内存中过滤 C，确认 Sheet 展示移除数量和名称。
- only_a：只保留 A；没有 A 时禁止创建空 session，可按原计划或返回调整。
- reduce_weight：动作不变；session 创建后降重。
- deload：移除 C 并降重。
- rest：默认不创建 session；“仍按原计划训练”需要二次确认。

过滤只改变新 session 的 `planExerciseIds` 快照，不更新 system/user plan 或 PlanExercise。

## 9. 临时降重

默认降幅 7.5%。Repository 只读取当前账号、当前 draft/in-progress session、显式成员、未完成/未跳过/未删除的 sets。目标重量按器械/成员增量调用既有取整函数；null、0、NaN、负数跳过。只更新 `planned_weight`；预填 `actual_weight` 仅在仍等于旧 planned 时随动，手工输入不覆盖。事务完成后逐 set 入队。

## 10. 小组训练

成员选择页逐人显示状态或“未评估”，并可进入对应成员评估。共享 session 仍只能有一份动作结构，因此汇总所选成员已评估结果，以最保守者作为建议。未评估成员不补成良好；部分未评估会明确提示。任何共享调整都必须由用户确认，也可以按原计划拒绝。

## 11. 与 progression 的关系

progression 表示长期表现形成的下次建议；recovery 表示当天临时调整。执行页顺序为长期建议、今日降幅、本次取整建议。应用 progression 时再叠加当前 recovery 降幅，但不修改 `progression_suggestions.suggested_weight`，也不改变长期建议类型。

## 12. 趋势统计

展示最近 10 条真实记录：日期、总分、状态、主要原因。折线横轴使用记录日期，不补未记录日为 0。统计平均分、良好次数、低状态次数和连续低状态；少于三条显示样本不足。

## 13. 测试与验收

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test -- --runInBand`：50 套件、256 用例通过。
- 覆盖评分、硬规则、连续低状态、六项 presentation、daily 幂等、scope、sync、过滤、无 A、重量取整和空重量。
- Android arm64 Release 构建通过。
- 176 主账号仅做只读真机验收：首页卡、六项内容、滚动、返回、未评估提示、直接进入成员选择及“未评估”状态通过；未保存或创建 session。

## 14. 数据库、API 与部署

移动 SQLite migration：无。后端 PostgreSQL migration：无。API 修改：无。服务器部署：不需要。未操作服务器数据库，未读写 176/188 服务端训练数据。

## 15. 已知限制与下一阶段

- 每成员独立动作结构尚未实现，需要未来 session schema 设计。
- 恢复状态/采用策略暂不持久化到 training report；执行路由只读展示当前降幅。
- 明确关节不适与具体主项的冲突无法由现有恢复字段自动定位，关节 5 作为硬休息覆盖，其他情况由安全文案和用户选择处理。
- 不接入穿戴设备、AI 自动调计划、复杂相关性、医疗诊断或动作图标。
