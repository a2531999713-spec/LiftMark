# History 模块概览

更新时间：2026-06-30

## 2026-06-30 记录详情与动作分析补充

- 历史训练详情默认只读，顶部更多菜单承载“编辑记录”和“删除整次训练”；进入编辑态后才显示字段输入、动作替换、组编辑和删除控件。
- 小组动作详情支持指标、时间范围和成员筛选，并使用多成员折线趋势展示最好重量、容量或预估 1RM。
- 历史详情和小组动作分析均读取训练时快照与 SQLite 真实记录，不回写原始计划模板。

## 1. 模块职责

查看最近训练、成员筛选、动作筛选、历史最好表现、预估 1RM 和最近进阶建议。

- 训练历史列表和训练详情读取。
- 按成员/动作筛选。
- 每个动作最近一次记录、历史最好表现、预估 1RM 展示。
- 最近 5 次重量、完成率、完成情况 和预估 1RM 趋势。
- PR 接近度和疲劳提示。
- 下次建议展示。

## 2. 非职责

- 不生成原始训练记录。
- 不修改计划模板。
- 不作为数据分析大盘，复杂图表第一版延后。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- workout
- member
- exercise
- progression
- weight

## 5. 被依赖模块

- export
- progression

## 6. 主要文件

Sprint 1 已创建基础领域、数据和页面占位骨架；以下路径按当前实现和后续计划合并列出：

| 文件 | 说明 |
|---|---|
| `app/(tabs)/history.tsx` | 训练历史页，展示最近训练和基础趋势卡片。 |
| `app/history/[sessionId].tsx` | 历史训练详情，默认只读，更多菜单进入编辑或删除。 |
| `app/history/group-exercise/[exerciseId].tsx` | 小组动作详情，支持指标、时间范围、成员筛选和多成员趋势线。 |
| `src/domain/history/history-analysis.ts` | 历史推算、Epley 预估 1RM、趋势和中文建议。 |
| `src/components/history/SessionHistoryCard.tsx` | 最近训练卡片。 |
| `src/components/history/ExerciseHistoryCard.tsx` | 动作历史卡片。 |
| `src/components/history/ProgressionSuggestionCard.tsx` | 进阶建议卡片。 |
| `src/domain/workout/workout.selectors.ts` | 历史统计选择器。 |

## 7. 核心数据结构

- WorkoutSession
- WorkoutSet
- ProgressionSuggestion

## 8. 修改风险

- 历史记录必须展示训练当时的计划快照，而不是当前计划。
- 第一版复杂图表延后，避免拖慢 MVP。
- 历史推算只能输出训练建议，不做医疗、伤病或绝对判断。

## 9. 需要人工确认的问题

- Sprint 1 已创建基础路径；后续 Sprint 若新增/迁移文件，需继续与实际源码对齐。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
