# Weight 模块实现文档

更新时间：2026-06-15  
对应代码目录：`training-partner-app/`；当前已实现基于成员 1RM、计划百分比、目标次数区间和器械加重单位的建议重量。

## 1. 模块职责

根据计划百分比或目标次数区间、成员 1RM 和器械加重单位计算建议重量，并提供预估 1RM。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/weight/weight.types.ts` | 重量计算输入输出类型。 |
| `src/domain/weight/weight-calculator.ts` | 建议重量、取整、预估 1RM。 |
| `src/tests/weight.test.ts` | 重量计算单元测试。 |

## 3. 核心类/函数

### roundToIncrement()

文件：见主要文件列表  
符号：`roundToIncrement()`  
搜索锚点：`roundToIncrement()`  
职责：按最小加重单位四舍五入。  
调用方：today-training-flow, workout, history, progression  
依赖：member, plan, exercise  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### calculateSuggestedWeight()

文件：见主要文件列表  
符号：`calculateSuggestedWeight()`  
搜索锚点：`calculateSuggestedWeight()`  
职责：优先按 percent1RM 和成员 1RM 生成建议重量；没有百分比时，可按目标次数区间映射为保守百分比。  
调用方：today-training-flow, workout, history, progression  
依赖：member, plan, exercise  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### estimatePercentFromTargetReps()

文件：见主要文件列表  
符号：`estimatePercentFromTargetReps()`  
职责：把 3/5/8/10/12/15 次附近的计划目标映射为保守 1RM 百分比，用于 PPL 等 次数区间计划的基础建议重量。  
调用方：`calculateSuggestedWeight()`  
测试：`src/tests/weight.test.ts`

### estimateOneRM()

文件：见主要文件列表  
符号：`estimateOneRM()`  
搜索锚点：`estimateOneRM()`  
职责：用重量和次数估算 1RM。  
调用方：today-training-flow, workout, history, progression  
依赖：member, plan, exercise  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

## 4. 数据结构

- MemberProfile
- PlanExercise
- Exercise

## 5. 调用关系

- 依赖：member, plan, exercise
- 被调用：today-training-flow, workout, history, progression

## 6. 测试位置

- 1RM 100kg，75%，2.5kg increment -> 75kg。
- 1RM 102kg，75%，2.5kg increment -> 77.5kg。
- 1RM 80kg，72.5%，2.5kg increment 的取整策略需明确。
- 杠铃动作使用 `barbellIncrement`，哑铃动作使用 `dumbbellIncrement`。
- 引体参考总负重缺失时可回退到体重。
- 没有百分比但有 5-8 次目标区间时，能推算出保守建议重量。
- `referenceLift: none` 时返回 manual 状态，UI 展示“参考上次重量”。

建议测试文件：

- `src/tests/weight.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 1RM 缺失时必须返回可解释状态，而不是 NaN。
- round 策略会影响 57.5kg 或 60kg 等边界，需要人工确认。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Weight 类型、取整、参考 1RM 和预估 1RM 函数已创建。
- 2026-06-09：同步 Sprint 3：`calculateSuggestedWeight` 已接入今日训练页，为不同成员生成不同建议重量。
- 2026-06-15：`calculateSuggestedWeight` 支持从目标次数区间推算保守百分比；训练页和创建 session 时都传入 reps/repMin/repMax。
