# 今日训练生成流程

更新时间：2026-06-09

## 1. 流程目标

根据当前小组、当前用户计划、周期、周数、星期和恢复状态生成当天训练内容。

## 2. 参与模块

- group
- member
- plan
- exercise
- weight
- recovery

## 3. 前置条件

- 本地 SQLite 可用。
- 系统方案和默认用户计划 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 读取 selectedGroupId 或默认小组。
2. 读取 activePlanId、currentWeek、fridayEnabled，并用默认 16 周周期推导 currentPhaseType。activePlanId 必须指向用户计划。
3. 根据 phase、week、weekday 查找 SQLite 中的 PlanDay。
4. 读取 PlanExercise，再通过 ExerciseRepository 读取 Exercise 元数据。
5. 按恢复状态过滤动作优先级：good 显示 A/B/C，normal 隐藏 C，bad 只显示 A，very_bad 清空动作。
6. 对每个成员调用重量计算模块生成建议重量；建议重量来自成员 1RM、计划百分比和动作器械类型。
7. 展示今日主题、动作列表、组数/次数、RPE/RIR 和每人建议重量。
8. 非休息日、有成员且过滤后仍有动作时，可开始训练并进入 `workout-execution-flow`。

## 5. 数据读写

写入或重点影响：

- 无，纯读取和派生；开始训练时才写 workout 数据。
- 点击开始训练后写入 `workout_sessions`、`workout_exercise_records`、`workout_sets`，详见 `workout-execution-flow.md`。

## 6. 异常与边界

- 周五 fridayEnabled=false 时返回休息日。
- 缺少 1RM 时显示未设置，不崩溃。
- 当前周使用全局 1-16 周：1-6 增力、7 减量、8-15 增肌、16 减量。
- 今日训练页不得硬编码计划动作；当前用户计划必须先 seed、复制、创建或导入到 SQLite。
- 今日训练不得直接读取系统方案 ID；训练记录不能直接绑定系统方案。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
