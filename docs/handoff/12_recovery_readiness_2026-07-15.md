# v2.10.0 恢复状态评估交接

## 已完成

- 六项恢复评分、硬性安全覆盖、连续三次低状态规则。
- 独立 `/recovery` 页面、今日紧凑入口、真实日期趋势与保存状态。
- 当前账号/小组/成员 scoped `RecoveryRepository`，同成员同日幂等 upsert。
- `recoveryLogs` 拉取精确成员映射与既有 push/队列复用。
- 开始训练前非阻塞未评估提示、成员状态、最保守建议确认。
- A/B/C 内存过滤、无 A 防空 session、休息二次确认、当前 session 未完成组临时降重。
- 训练执行页按“长期建议 → 今日恢复调整 → 本次建议”展示，不回写 progression suggestion。

## 数据边界

- 不修改 plan template、PlanExercise、历史 session/set、训练报告或长期进阶建议。
- 没有 schema migration、API、PostgreSQL 或服务器部署变更。
- 176/188 服务端数据均未操作；未执行迁移、删除或 owner 改写。

## 验证状态

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test -- --runInBand`：50 套件、256 用例通过。
- Android arm64 Release 构建通过。
- 真机已在 176 主账号执行只读验收：首页卡、六项评估、滚动、返回、未评估提示、“直接开始”进入成员选择和“未评估”状态通过；为保护 176 未保存评估或创建 session。

## 已知限制

- session 仍共享动作结构，不支持每位成员独立过滤动作。
- 恢复建议不写入 training report；本次降重说明通过创建后的执行路由展示。
- 不接入穿戴设备、AI 调计划、医疗判断或动作图标。
