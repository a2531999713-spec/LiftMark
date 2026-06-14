# Member 测试计划

更新时间：2026-06-09

## 1. 单元测试范围

- 创建 2-4 个成员后均可独立保存 1RM。
- 关闭 App 后成员资料仍存在。
- 缺失 1RM 时今日训练页不崩溃。
- 成员表单允许 1RM 留空。
- 本地默认小组最多 4 名成员。

## 2. 集成测试范围

- Repository 与 SQLite 表结构联调。
- 与依赖模块的数据流联调：group, weight。
- 与被依赖模块联调：workout, history, progression, export。

## 3. E2E 测试范围

- 首次使用后能进入今日训练。
- 成员、计划、训练、历史和导出闭环不丢数据。
- 断网时训练流程仍可完成。

## 4. 必测场景

- 创建 2-4 个成员后均可独立保存 1RM。
- 关闭 App 后成员资料仍存在。
- 缺失 1RM 时今日训练页不崩溃。
- 新增第 5 个成员时入口被禁用或阻止。
- 编辑成员后返回成员列表能看到更新后的名称和 1RM 状态。

## 5. 边界场景

- 1RM 为空时不得阻塞进入 App，但建议重量必须显示“未设置 1RM”。
- 成员删除策略待确认，不能破坏历史训练记录。

## 6. 回归测试点

- 修改该模块后，检查相关流程文档是否需要更新。
- 修改数据结构后，检查 `docs/database/schema.md`。
- 修改 Repository 后，检查 `docs/api/local-repository-api.md`。

## 7. 测试文件位置

- `src/tests/member.test.ts`
- Repository 测试位置：`training-partner-app/src/tests/`，后续可按模块拆分测试文件。

当前已覆盖：

- `src/tests/member.test.ts`：成员数量限制、1RM 可空、昵称必填、1RM 状态判断。
