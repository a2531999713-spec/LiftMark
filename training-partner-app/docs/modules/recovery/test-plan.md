# Recovery 测试计划

更新时间：2026-07-15

## v2.10.0 自动化结果

- 全量 Jest：50 套件、256 用例通过。
- 恢复相关：评分阈值/硬规则/连续低状态、六项 UI model、当日幂等、账号与小组隔离、pull 精确挂载、A/B/C 过滤、无 A 防空 session、重量取整、0/空重量保护。

## 1. 单元测试范围

- 25–30 且无硬风险 -> normal；21–24 -> remove_c；17–20 -> reduce_weight；13–16 -> only_a；不高于 12 -> rest。
- fatigue=4 / soreness=4、joint=4、joint/fatigue=5、明显不适等硬规则。
- 连续三条低建议且均分低于 17 -> deload；不自动改计划周期。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：member, plan。
- 与被依赖模块联调：today-training-flow, workout, progression。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 高分 -> normal。
- 中等 -> remove_c。
- 较低 -> only_a。
- 关节痛高 -> only_a / bad。

## 5. 边界场景

- 关节不适高分应优先休息或只做 A，不能硬推训练。
- 恢复评分输入可能缺失，今日训练应有默认模式。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/recovery.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
