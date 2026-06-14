# History 测试计划

更新时间：2026-06-11

## 1. 单元测试范围

- 训练完成后历史列表可见。
- 按成员和动作筛选能返回正确记录。
- 替换动作历史能显示原动作与替代动作。
- Epley 公式预估 1RM。
- 最近 5 次训练重量、完成率、RPE/RIR、预估 1RM 趋势。
- PR 接近度和疲劳提示仅作为建议输出。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：workout, member, exercise, progression, weight。
- 与被依赖模块联调：export, progression。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 训练完成后历史列表可见。
- 按成员和动作筛选能返回正确记录。
- 替换动作历史能显示原动作与替代动作。
- 近期表现接近 PR 时显示“近期表现接近 PR，可考虑小幅尝试”。
- 连续高 RPE 或连续未完成时提示“近期疲劳偏高，建议维持或减量”。

## 5. 边界场景

- 历史记录必须展示训练当时的计划快照，而不是当前计划。
- 第一版复杂图表延后，避免拖慢 MVP。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/history.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
