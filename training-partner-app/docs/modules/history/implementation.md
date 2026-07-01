# History 模块实现文档

更新时间：2026-07-01  
对应代码目录：`training-partner-app/`；历史页已从训练流水列表调整为分析导向的个人记录中心，并支持小组汇总、动作筛选、主项成员对比和折线趋势推算。

## 2026-07-01 补充：个人记录、补录和详情编辑收口

- 个人历史页移除重复“训练查询”区块；动作筛选继续驱动训练趋势、当天记录和最近记录入口。
- `app/history/manual.tsx` 支持一次补录多个动作，每个动作可维护独立组数、重量和次数。
- `WorkoutRepository.createManualSession()` 支持 `exercises` 输入，旧 `exerciseId + setCount` 仍兼容。
- `app/history/[sessionId].tsx` 在编辑态支持新增动作、新增组、删除组和基础信息保存；个人口径只编辑当前成员 sets，小组口径按本次参与成员追加。
- `WorkoutRepository.addExerciseToSession()` 与 `addSetToExerciseRecord()` 为历史详情编辑提供 Repository 边界。
- `app/history/exercise/[exerciseId].tsx` 移除 RPE 指标与趋势图，仅保留训练容量、最佳重量和估算 1RM 趋势。

## 2026-07-01 addendum: selector defaults, scoped detail, and chart axis

- `app/(tabs)/history.tsx` now uses one bottom action selector. The default all-action state shows current-member total volume; selecting an exercise narrows trends, day records, and query results.
- Group history keeps overview as the default. `GroupExercisePerformanceCard` no longer auto-selects the first exercise or shows a duplicate four-exercise grid.
- Personal session cards pass `scope=personal` and `memberId`; `app/history/[sessionId].tsx` filters visible sets to that member. Group detail continues to show all members.
- `src/components/ui/chartScale.ts` provides shared Y-axis scale for `MiniLineChart` and `MultiLineTrendChart`, with tests for equal values, zero-only values, and shared multi-line ranges.

## 2026-06-30 补充：个人记录页产品级重构

- `app/(tabs)/history.tsx` 的个人视图结构为：本周概览、核心指标、动作筛选、训练趋势、日历当天记录和最近记录入口。
- 个人记录页不再以近期训练列表作为顶部核心模块；最近记录服务于查看当天训练和进入详情，不再重复展示独立查询区块。
- 动作筛选来自当前成员真实训练记录中的 distinct `exerciseId`，默认“全部动作”；选择动作后趋势和查询列表按该动作收敛。
- 点击周日历或月日历只更新 `selectedDate`，不再触发整页 `loadHistory()`，避免滚动位置跳回顶部。
- `MiniLineChart` / `MultiLineTrendChart` 在组件层做横轴标签抽样，手机窄屏默认最多显示 5 个标签。
- 小组动作卡默认保留总览，不自动进入具体动作；小组动作详情页图表标题必须包含“动作 + 指标”。
- 历史补录页不再展示休息秒字段；休息时间作为训练现场内部数据保留，不作为记录页默认信息。

## 2026-06-30 补充：趋势图与动作详情

- `MiniLineChart` 和 `MultiLineTrendChart` 统一增加 Y 轴刻度与 `unitLabel`，训练容量、重量、1RM、身体数据等图表必须显示量纲。
- 个人训练趋势、小组趋势和小组动作趋势改为按实际训练记录或实际训练日期展示，不用自然日补零制造断崖；周趋势使用周起止日期，例如 `6/24-6/30`。
- 训练分析页支持最近 4 / 8 / 12 周。
- 新增 `app/history/exercise/[exerciseId].tsx`：展示当前成员单动作历史、容量、最佳重量、估算 1RM 趋势和最近有效组。
- 小组记录默认展示总览，不默认进入卧推；动作表现通过带箭头的选择器切换真实练过的 `exerciseId`。
- `app/history/group-exercise/[exerciseId].tsx` 默认分析指标改为训练容量，并按真实动作 ID 过滤当前小组训练记录。

## 1. 模块职责

查看近期训练、成员筛选、动作筛选、历史最好表现、预估 1RM 和最近进阶建议。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `app/(tabs)/history.tsx` | 训练历史页，读取最近 session，展示个人记录、小组汇总和折线趋势卡片。 |
| `app/history/manual.tsx` | 补录过去训练。 |
| `app/history/[sessionId].tsx` | 查看某次训练详情，默认只读；顶部更多菜单进入编辑记录或删除整次训练。 |
| `app/history/group-exercise/[exerciseId].tsx` | 小组动作详情，按真实 `exerciseId` 汇总成员最好重量、容量、预估 1RM、最近有效组，并提供指标 / 时间范围 / 成员筛选和多成员趋势线。 |
| `src/domain/history/history-analysis.ts` | Epley 预估 1RM、个人趋势、小组汇总、成员贡献、PR 接近度、疲劳提示和中文建议。 |
| `src/components/ui/MiniLineChart.tsx` | 记录页、训练分析页和计划页共用的轻量折线趋势图。 |
| `src/components/history/SessionHistoryCard.tsx` | 训练摘要卡。 |
| `src/components/history/ExerciseHistoryCard.tsx` | 动作历史卡片。 |
| `src/components/history/ProgressionSuggestionCard.tsx` | 进阶建议卡片。 |
| `src/domain/workout/workout.selectors.ts` | 历史统计选择器。 |

## 3. 核心类/函数

### WorkoutRepository.listSessions

文件：见主要文件列表  
符号：`WorkoutRepository.listSessions`  
搜索锚点：`WorkoutRepository`  
职责：按条件读取训练 session。  
调用方：export, progression  
依赖：workout, member, exercise, progression, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### 记录日历与详情

文件：`app/(tabs)/history.tsx`  
职责：支持周日期点击、月视图、训练日期红点、查看某天训练记录和进入详情；训练查询列表使用摘要卡展示标题、日期/时长、动作数、完成组数、总训练量、成员口径、PR/估算 1RM/趋势标签。  

文件：`app/history/manual.tsx`  
职责：选择日期、成员，补录多个动作和多组独立重量 / 次数，并保存到 SQLite。

文件：`app/history/[sessionId].tsx`  
职责：展示日期、成员、动作、组数、重量、次数、完成情况、训练量和建议；默认只读，进入编辑态后支持修改历史记录，并通过更多菜单二次确认删除。替换动作记录会展示“由原动作替换为实际动作”。

### ProgressionRepository.getLatestSuggestion

文件：见主要文件列表  
符号：`ProgressionRepository.getLatestSuggestion`  
搜索锚点：`ProgressionRepository`  
职责：读取成员动作最近建议。  
调用方：export, progression  
依赖：workout, member, exercise, progression, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### estimateOneRM()

文件：`src/domain/history/history-analysis.ts`  
符号：`estimateOneRM()`  
搜索锚点：`estimateOneRM()`  
职责：使用 Epley 公式 `weight * (1 + reps / 30)` 从历史重量和次数估算 1RM。  
调用方：export, progression  
依赖：workout, member, exercise, progression, weight  
测试：`src/tests/history.test.ts`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

## 4. 数据结构

- WorkoutSession
- WorkoutSet
- ProgressionSuggestion

## 5. 调用关系

- 依赖：workout, member, exercise, progression, weight
- 被调用：export, progression

## 6. 测试位置

- 训练完成后历史列表可见。
- 按成员和动作筛选能返回正确记录。
- 替换动作历史能显示原动作与替代动作。
- Epley 预估 1RM、PR 接近度和疲劳提示。

建议测试文件：

- `src/tests/history.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 历史记录必须展示训练当时的计划快照，而不是当前计划。
- 第一版复杂图表延后，避免拖慢 MVP。
- 历史编辑不能回写原计划，必须保留训练当时记录快照。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：历史页占位、workout/progression 数据访问骨架已创建。
- 2026-06-11：同步稳定性与基础体验 Sprint：新增历史页基础卡片、`history-analysis.ts`、Epley 预估 1RM、最近 5 次趋势、PR 接近度和中文建议；新增 `src/tests/history.test.ts`。
- 2026-06-12：同步可用性 + UI 落地 Sprint：记录页日历可点击，新增月视图、补录训练、历史详情和编辑能力；训练记录继续保存 SQLite。
- 2026-06-12：同步本地图片资产落地：记录页空状态 Hero、历史补录页和训练总结页使用 `liftmarkImages.historyHero`；历史分析和训练记录读写逻辑未变。
- 2026-06-14：训练查询列表改为紧凑摘要卡；空状态补充“去训练”入口；点击卡片进入 `app/history/[sessionId].tsx`，历史记录继续读取训练时快照。
- 2026-06-29：记录页新增个人 / 小组视角；小组汇总接入 `getGroupHistoryAnalysis()` 和本机 SQLite 训练详情；记录页、训练分析页、计划执行趋势统一改为折线趋势。
- 2026-06-30：历史详情页改为默认只读，编辑和删除收进顶部更多菜单；小组动作表现卡新增详情入口；`app/history/group-exercise/[exerciseId].tsx` 从 SQLite session 明细即时汇总成员对比和最近有效组，按真实 `exerciseId` 展示动作，并新增指标、时间范围、成员筛选和多成员趋势线。
- 2026-07-01：个人历史移除重复查询区块；补录支持多动作和多组独立数据；详情编辑支持新增动作、新增组和删组；动作历史移除 RPE 展示。

### analyzeExerciseHistory()

文件：`src/domain/history/history-analysis.ts`  
符号：`analyzeExerciseHistory()`  
搜索锚点：`analyzeExerciseHistory`  
职责：基于最近 5 条历史 set 计算完成率、重量趋势、预估 1RM 趋势、PR 接近度和疲劳提示，并输出中文建议。  
调用方：`app/(tabs)/history.tsx`  
依赖：workout  
测试：`src/tests/history.test.ts`

修改注意：

1. 结论必须是建议，不能写成绝对判断。
2. 不做医疗或伤病判断。
3. 修改后同步 `test-plan.md`。

### getGroupHistoryAnalysis()

文件：`src/domain/history/history-analysis.ts`  
符号：`getGroupHistoryAnalysis()`  
职责：基于本机训练详情和本地成员列表生成小组总训练量、训练次数、完成率、成员贡献排行、近 7 天折线趋势、最近小组训练记录、小组洞察和真实练过的动作列表。动作分析按 `workout_exercise_records.exercise_id` 聚合，不按旧的固定默认动作或泛化类别聚合入口。  
调用方：`app/(tabs)/history.tsx`  
依赖：workout, member  
测试：`src/tests/history.test.ts`

修改注意：

1. 不要在页面组件中硬编码小组统计。
2. 只能基于 Repository 读取到的真实 SQLite 训练记录生成结果。
3. 未训练成员应显示为待开始，而不是填充假训练量。
4. 动作下拉只能优先列出真实练过的动作；无数据动作不得画假趋势。
