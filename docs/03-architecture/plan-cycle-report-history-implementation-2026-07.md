# LiftMark P1：计划周期、训练报告详情与历史筛选实施记录

更新时间：2026-07-11

## 1. 目标与边界

本轮在既有 `AccountScope / AppScope`、SQLite Repository、同步实体 registry 和 P0 表结构上补齐以下产品闭环：

```text
PlanCycle → WorkoutSession → TrainingReport → History
```

未重构账号、小组、同步和数据库基础架构；未新增 SQLite / PostgreSQL migration，未修改 API、共享包或管理后台，未部署服务器，也未读写生产数据库。

## 2. 实际实现

- 训练结束页和历史详情页都可进入 `/report/[sessionId]`。报告展示日期、起止时间、时长、计划和周期、训练类型、成员汇总、动作/组明细、总组数、总次数、总训练量、估算热量、强度和备注。
- 缺少 `training_reports` 的旧训练只构造只读 fallback 展示模型，不因打开页面而补写历史数据。
- 热量公式集中在 `src/domain/report/trainingReport.service.ts`；缺失体重按每位缺失参与者 65kg 估算，并在 UI 明示默认值和估算范围。
- 计划页展示当前或最近周期卡；`/plan/cycle/[cycleId]` 展示完成率、汇总指标、周期内训练及单次报告入口，并提供带二次确认的完成/归档动作。
- 周期总结优先使用同一 session 的 `training_reports`，缺失时从 session/set 聚合；按当前 owner + cycle 复用同一 summary 行并幂等更新。
- 记录页支持全部、当前周期、具体历史周期、自由训练、补录训练筛选。列表由单次 scoped aggregate query 返回，不逐条调用详情接口。

## 3. 页面入口

```text
训练结束 → app/workout/summary/[sessionId].tsx → /report/[sessionId]
记录详情 → app/history/[sessionId].tsx → /report/[sessionId]
计划 Tab → 当前周期卡 → /plan/cycle/[cycleId]
记录 Tab → 周期/训练类型筛选 → 训练详情或训练报告
```

## 4. 数据流与统计口径

```text
页面 → controller/use case → scoped repository → local SQLite
训练保存 → training_reports upsert → local_sync_queue(owner_user_id)
完成/归档 → plan_cycle_summaries upsert → local_sync_queue(owner_user_id)
```

- 所有报告、周期和历史查询同时约束当前 `owner_user_id` 与 `group_id`；具体历史周期还约束 `plan_cycle_id`。
- 报告更新以当前认证账号为 owner，查找和 UPDATE 都包含 owner 条件，不改写已创建记录的 owner。
- 完成组口径为 `completed=1 AND skipped=0 AND deleted_at IS NULL`。
- 当前模型没有可靠的“主动跳过训练日”事件，因此周期 `skippedWorkoutCount` 保持 0，不把未完成计划日伪装成跳过。
- archived 周期不会再作为 active cycle 返回，但训练、报告和 summary 仍可查询。

## 5. 状态机

本轮保留现有 `draft / active / completed / archived / abandoned` 语义：

```text
active → completed → archived
completed → completed（幂等）
archived → archived（幂等）
```

归档不会删除或重绑计划、训练、训练报告；重复完成、重算或归档只更新既有 owner + cycle summary。

## 6. 同步与兼容策略

- 继续复用 registry 中的 `planCycles`、`planCycleSummaries`、`trainingReports`、`workoutSessions` 字段映射和 pull applier。
- 新增 registry 回归断言，覆盖周期归档时间、报告热量上下限和 summary 统计字段。
- 旧训练报告缺失时只读降级；不自动迁移旧数据，不改变 fresh install / cleared app data 基线。
- 未把 `groups / groupMembers / memberProfiles` 强行改入 generic sync。

## 7. 验证结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test -- --runInBand`：36 个套件、177 个测试全部通过。
- `npm run android:apk:device`：通过，arm64-v8a Release APK 构建成功。
- 188 写入验收与 176 只读验收：尚未执行。当前连接设备安装的是不可调试 Release；为避免覆盖未知登录账号并触发 176 数据写入，本轮未安装新 APK、未进行账号切换或生产同步。

## 8. 已知限制与后续工作

- 需要在明确处于 188 测试账号的隔离设备/可清数据环境完成训练、报告、筛选、周期完成归档、重启和同步全流程，再对 176 做只读隔离核验。
- 本 Sprint 不实现自动生成下一周期、AI 周期总结、智能调计划、动作进步预测和复杂图表。
- 正式合并前应补一次真实设备视觉走查，重点检查小屏文本换行、深色模式、历史周期选择 Sheet 和危险动作确认。
