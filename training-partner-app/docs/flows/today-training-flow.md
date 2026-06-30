# 今日训练生成流程

更新时间：2026-06-30

## 1. 流程目标

根据当前小组、当前用户计划、临时选择的周次/训练日和动作筛选生成当天训练内容。

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
2. 读取 activePlanId、currentWeek、fridayEnabled 和当前用户计划。activePlanId 必须指向用户计划。
3. 今日训练页可临时选择周次和训练日；选择只影响当前展示和即将开始的 session，不修改 `groups.current_week`。
4. 页面展示和“开始训练”必须都通过同一份最新选择重新解析计划日，不能使用旧的 cached todayPlan。
5. 根据临时 week、weekday 和所属 phase 查找 SQLite 中的 PlanDay。
6. 读取 PlanExercise，再通过 ExerciseRepository 读取 Exercise 元数据。
7. 按动作筛选过滤动作优先级：完整动作显示 A/B/C，精简辅助隐藏 C，只做主项只显示 A，改为休息清空动作。
8. 对当前成员调用重量计算模块生成建议重量；建议重量来自成员 1RM、计划百分比和动作器械类型。
9. 展示当前计划、周次/训练日、动作筛选、今日摘要、动作列表和周概览；开始训练行动卡放在动作列表和周概览之前。
10. 点击开始训练前选择记录范围：仅我记录或小组成员，并选择参与成员。
11. 非休息日、有成员且过滤后仍有动作时，确认参与成员后进入 `workout-execution-flow`。

## 5. 数据读写

写入或重点影响：

- 无，今日页本身纯读取和派生；临时周次/训练日选择不写入 SQLite。
- 确认记录范围后才写入 `workout_sessions`、`workout_exercise_records`、`workout_sets`，详见 `workout-execution-flow.md`。

## 6. 异常与边界

- 周五 fridayEnabled=false 时返回休息日。
- 缺少 1RM 时显示未设置，不崩溃。
- 当前周使用全局 1-16 周：1-6 增力、7 减量、8-15 增肌、16 减量。
- 今日训练页不得硬编码计划动作；当前用户计划必须先 seed、复制、创建或导入到 SQLite。
- 今日训练不得直接读取系统方案 ID；训练记录不能直接绑定系统方案。
- 自由训练入口进入补录训练，不创建空动作 session。
- 如果当天已有未完成 session，且 `planId/week/weekday/trainingMode` 与当前选择不同，必须弹出冲突处理，不得静默复用旧 session。

## 7. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
