# Weight 模块概览

更新时间：2026-06-09

## 1. 模块职责

根据计划百分比、成员 1RM 和器械加重单位计算建议重量，并提供预估 1RM。

- roundToIncrement。
- calculateSuggestedWeight。
- 根据 referenceLift 获取成员对应 1RM。
- 根据 equipment 选择杠铃/哑铃加重单位。
- estimateOneRM。

## 2. 非职责

- 不决定是否加重、维持或减量。
- 不保存训练记录。
- 不读取 UI 状态。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- member
- plan
- exercise

## 5. 被依赖模块

- today-training-flow
- workout
- history
- progression

## 6. 主要文件

Sprint 3 已实现建议重量计算；以下路径按当前实现列出：

| 文件 | 说明 |
|---|---|
| `src/domain/weight/weight.types.ts` | 重量计算输入输出类型。 |
| `src/domain/weight/weight-calculator.ts` | 建议重量、取整、预估 1RM。 |
| `src/tests/weight.test.ts` | 重量计算单元测试。 |

## 7. 核心数据结构

- MemberProfile
- PlanExercise
- Exercise

## 8. 修改风险

- 1RM 缺失时必须返回可解释状态，而不是 NaN。
- round 策略会影响 57.5kg 或 60kg 等边界，需要人工确认。

## 9. 需要人工确认的问题

- round 策略当前使用四舍五入到最接近的成员加重单位；如需向下/向上取整，需同步修改测试。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
