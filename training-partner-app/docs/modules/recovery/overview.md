# Recovery 模块概览

更新时间：2026-06-30

## 2026-06-30 动作筛选命名补充

- UI 中不再把这项能力称为状态类入口，统一显示为“动作筛选”。
- “动作筛选”复用恢复模块的 A/B/C 过滤规则：完整动作、精简辅助、只做主项、改为休息。
- 开始训练时筛选后的计划动作 ID 会写入创建 session 的输入，训练记录保存的是本次动作快照。

## 1. 模块职责

根据睡眠、食欲、训练欲望、酸痛、关节不适和疲劳生成恢复建议，并影响 A/B/C 动作显示。

- RecoveryLog 数据模型。
- 恢复评分 totalScore 和 recommendation。
- normal、remove_c、only_a、reduce_weight、deload、rest 建议。
- 动作筛选对动作优先级过滤的规则。

## 2. 非职责

- 不保存训练 set。
- 不直接改计划模板。
- 不替代用户的手动休息决定。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- member
- plan

## 5. 被依赖模块

- today-training-flow
- workout
- progression

## 6. 主要文件

Sprint 3 已实现恢复评分和今日训练过滤；当前 UI 以“动作筛选”呈现这条过滤规则。以下路径按当前实现列出：

| 文件 | 说明 |
|---|---|
| `src/domain/recovery/recovery.types.ts` | 恢复评分类型。 |
| `src/domain/recovery/recovery-engine.ts` | 恢复建议计算。 |
| `src/domain/plan/plan.service.ts` | A/B/C 动作过滤。 |
| `src/tests/recovery.test.ts` | 恢复算法测试。 |

## 7. 核心数据结构

- RecoveryLog
- recovery_logs
- RecoveryMode

## 8. 修改风险

- 关节不适高分应优先休息或只做 A，不能硬推训练。
- 恢复评分输入可能缺失，今日训练应有默认模式。

## 9. 需要人工确认的问题

- 恢复评分保存到 SQLite 的 Repository 尚未实现；Sprint 3 仅实现计算和今日训练手动状态过滤。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
