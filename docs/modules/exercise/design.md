# Exercise 模块设计文档

更新时间：2026-06-09

## 1. 设计目标

让 `exercise` 模块拥有清晰边界，支撑多人训练 MVP，并为后续云同步、计划编辑器或商业版扩展保留空间。

## 2. 模块职责

- Exercise 和 ExerciseAlternative 数据模型。
- 默认动作库与动作替换库 seed。
- 动作分类：胸推、垂直拉、水平拉、深蹲类、髋铰链、肩推、孤立动作等。
- 替代动作必须保持动作模式和训练目的尽量一致。

## 3. 非职责

- 不保存某次训练的替换结果，替换结果由 workout_exercise_records 保存。
- 不计算建议重量，只提供 referenceLift、equipment 等输入信息。

## 4. 核心业务规则

- 替换动作不能改变训练目的，例如飞鸟不能完全替代卧推主项。
- 器械被占时允许替换，但原计划动作必须保留为 replaced_from_exercise_id。

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

- Sprint 3 已将默认动作库和替换库作为 seed 数据落入 SQLite。
- 后续动作替换执行流程需要在 workout 记录中保留原动作和替换动作。

## 10. 扩展点

- Repository 接口可增加远程同步实现。
- Domain 函数应保持可测试、可复用。
- seed 数据可替换为用户自定义计划或导入计划。

## 11. 修改风险

- 替换动作不能改变训练目的，例如飞鸟不能完全替代卧推主项。
- 器械被占时允许替换，但原计划动作必须保留为 replaced_from_exercise_id。
