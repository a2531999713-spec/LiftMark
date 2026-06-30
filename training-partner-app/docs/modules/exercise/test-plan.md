# Exercise 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 动作替换库能按原动作返回替代项。
- 今日训练能通过 `exercise_id` 批量读取动作名、器械类型和目标肌群。
- 替换后历史记录保留原动作和新动作。
- 无替代动作时 UI 给出空状态。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：无直接领域依赖。
- 与被依赖模块联调：plan, workout, progression, history。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 动作替换库能按原动作返回替代项。
- 默认动作库 seed 覆盖计划动作、周五补弱菜单动作和替换库动作。
- 替换后历史记录保留原动作和新动作。
- 无替代动作时 UI 给出空状态。

## 5. 边界场景

- 替换动作不能改变训练目的，例如飞鸟不能完全替代卧推主项。
- 器械被占时允许替换，但原计划动作必须保留为 replaced_from_exercise_id。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/exercise.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。
