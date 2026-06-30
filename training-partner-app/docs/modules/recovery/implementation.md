# Recovery 模块实现文档

更新时间：2026-06-30  
对应代码目录：`training-partner-app/`；已实现恢复评分引擎，并将 A/B/C 过滤以“动作筛选”接入今日训练和 session 创建。

## 1. 模块职责

根据睡眠、食欲、训练欲望、酸痛、关节不适和疲劳生成恢复建议；今日训练页使用同一 A/B/C 过滤规则作为“动作筛选”。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/recovery/recovery.types.ts` | 恢复评分类型。 |
| `src/domain/recovery/recovery-engine.ts` | 恢复建议计算。 |
| `src/domain/plan/plan.service.ts` | `filterExercisesByRecovery`，按动作筛选状态过滤计划动作。 |
| `app/(tabs)/today.tsx` | 展示“动作筛选”，并把筛选后的 `planExerciseIds` 传入 session 创建。 |
| `src/tests/recovery.test.ts` | 恢复算法测试。 |

## 3. 核心类/函数

### calculateRecoveryScore()

文件：见主要文件列表  
符号：`calculateRecoveryScore()`  
搜索锚点：`calculateRecoveryScore()`  
职责：计算恢复总分和训练建议。  
调用方：today-training-flow, workout, progression  
依赖：member, plan  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### filterExercisesByRecovery()

文件：见主要文件列表  
符号：`filterExercisesByRecovery()`  
搜索锚点：`filterExercisesByRecovery()`  
职责：按动作筛选状态过滤 A/B/C 动作。  
调用方：today-training-flow, workout, progression  
依赖：member, plan  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

## 4. 数据结构

- RecoveryLog
- recovery_logs
- RecoveryMode：`good` 保留 A/B/C，`normal` 删除 C，`bad` 只保留 A，`very_bad` 清空动作。

## 5. 调用关系

- 依赖：member, plan
- 被调用：today-training-flow, workout, progression

## 6. 测试位置

- 高分 -> normal。
- 中等 -> remove_c。
- 较低 -> only_a。
- 关节痛高 -> only_a / bad。

建议测试文件：

- `src/tests/recovery.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 关节不适高分应优先休息或只做 A，不能硬推训练。
- 恢复评分输入可能缺失，今日训练应有默认模式。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Recovery 类型和 SQLite 表结构已创建。
- 2026-06-09：同步 Sprint 3：新增 `calculateRecoveryScore`，`getTodayPlan` 支持按恢复规则过滤 A/B/C。
- 2026-06-30：用户可见文案改为“动作筛选”；开始训练时把筛选后的计划动作 ID 写入 `CreateSessionFromTodayPlanInput`，保证训练记录保存本次动作快照。
