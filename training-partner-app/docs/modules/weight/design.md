# Weight 模块设计文档

更新时间：2026-06-15

## 1. 设计目标

让 `weight` 模块拥有清晰边界，支撑多人训练 MVP，并为后续云同步、计划编辑器或商业版扩展保留空间。

## 2. 模块职责

- roundToIncrement。
- calculateSuggestedWeight。
- 根据 referenceLift 获取成员对应 1RM。
- 无明确百分比但有参考主项和目标次数区间时，按保守百分比估算建议重量。
- 根据 equipment 选择杠铃/哑铃加重单位。
- estimateOneRM。

## 3. 非职责

- 不决定是否加重、维持或减量。
- 不保存训练记录。
- 不读取 UI 状态。

## 4. 核心业务规则

- 1RM 缺失时必须返回可解释状态，而不是 NaN。
- 如果计划动作有 `percent1RM`，优先按百分比计算。
- 如果没有 `percent1RM`，但有 `referenceLift` 和 `repMax/reps/repMin`，按目标次数区间保守映射为百分比，再按成员 1RM 计算。
- 如果 `referenceLift` 为 `none`，返回手动/参考历史重量状态，不强行显示“现场决定”。
- round 策略会影响 57.5kg 或 60kg 等边界，需要人工确认。

## 5. 状态流转

- 本模块状态必须通过 Repository 写入 SQLite 或由 Domain 纯函数派生。
- 涉及训练执行的数据不得只存在组件局部状态。

## 6. 权限规则

第一版为本地默认小组，不做账号鉴权。模型和 Repository 需保留后续 owner/member/coach/guest 扩展空间。

## 7. 输入输出

- 输入：来自 UI 表单、SQLite Repository、seed 数据或其他 Domain 模块。
- 输出：领域对象、派生结果、Repository 持久化结果或 UI 可展示 ViewModel。

## 8. 异常处理

- 输入缺失时返回可解释状态，不让 UI 崩溃。
- SQLite 写入失败必须上抛或返回错误结果。
- 不允许静默丢弃训练现场输入。

## 9. 边界条件

- 建议重量计算由今日训练页和训练 session 创建共同调用，展示层需要把缺少 1RM、参考历史重量和估算来源说明清楚。
- 取整策略变更必须同步 `src/tests/weight.test.ts` 和今日训练显示。

## 10. 扩展点

- Repository 接口可增加远程同步实现。
- Domain 函数应保持可测试、可复用。
- seed 数据可替换为用户自定义计划或导入计划。

## 11. 修改风险

- 1RM 缺失时必须返回可解释状态，而不是 NaN。
- round 策略会影响 57.5kg 或 60kg 等边界，需要人工确认。
