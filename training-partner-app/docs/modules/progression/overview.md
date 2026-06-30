# Progression 模块概览

更新时间：2026-06-09

## 1. 模块职责

训练完成后基于完成情况、失败次数和双进阶规则生成下次建议。

- ProgressionSuggestion 数据模型。
- 增力期 increase / maintain / decrease / deload 规则。
- 增肌期 increase / add_reps / maintain_or_decrease 规则。
- 完成训练时批量生成 progression_suggestions。

## 2. 非职责

- 不保存每组训练原始记录。
- 不决定今日训练动作列表。
- 不直接修改计划模板。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- workout
- weight
- exercise
- member

## 5. 被依赖模块

- history
- workout-summary-flow

## 6. 主要文件

Sprint 1 已创建基础领域、数据和页面占位骨架；以下路径按当前实现和后续计划合并列出：

| 文件 | 说明 |
|---|---|
| `src/domain/progression/progression.types.ts` | 进阶建议类型。 |
| `src/domain/progression/progression-engine.ts` | 增力/增肌建议引擎。 |
| `src/data/local/repositories/progressionRepository.ts` | 进阶建议 Repository。 |
| `src/tests/progression-engine.test.ts` | 进阶算法测试。 |

## 7. 核心数据结构

- ProgressionSuggestion
- progression_suggestions

## 8. 修改风险

- 连续失败次数统计口径需要确认。
- 建议不得覆盖训练者手动记录，只能作为建议保存。

## 9. 需要人工确认的问题

- Sprint 1 已创建基础路径；后续 Sprint 若新增/迁移文件，需继续与实际源码对齐。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
