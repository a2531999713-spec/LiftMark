# Workout 模块设计文档

更新时间：2026-06-09

## 1. 设计目标

让 `workout` 模块拥有清晰边界，支撑多人训练 MVP，并为后续云同步、计划编辑器或商业版扩展保留空间。

## 2. 模块职责

- WorkoutSession、WorkoutExerciseRecord、WorkoutSet。
- 从今日训练生成 session、exercise records、workout sets。
- 训练执行页默认按动作轮换，当前动作下按成员记录 set。
- 每次修改立即保存 SQLite，离开页面后可恢复。

## 3. 非职责

- 不定义计划模板本身。
- 不直接决定进阶建议，只在完成训练后触发 progression。
- 不把训练记录保存到 AsyncStorage。

## 4. 核心业务规则

- 训练现场输入必须低摩擦，不能频繁要求键盘输入。
- 训练进行中退出 App 不能丢 set 记录。
- 计划修改不能回写破坏已完成历史。

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

- Sprint 4 已落地按动作轮换执行页；每个成员的每组记录独立保存到 `workout_sets`。
- 训练执行页使用大按钮 stepper 和 RPE/RIR 快捷输入，不做 Excel 表格。
- 动作替换、跳过动作和进阶建议触发仍待后续 Sprint。

## 10. 扩展点

- Repository 接口可增加远程同步实现。
- Domain 函数应保持可测试、可复用。
- seed 数据可替换为用户自定义计划或导入计划。

## 11. 修改风险

- 训练现场输入必须低摩擦，不能频繁要求键盘输入。
- 训练进行中退出 App 不能丢 set 记录。
- 计划修改不能回写破坏已完成历史。
