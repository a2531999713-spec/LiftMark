# History 模块实现文档

更新时间：2026-06-30  
对应代码目录：`training-partner-app/`；历史页已展示个人记录、小组汇总、最近训练、主项成员对比和折线趋势推算，复杂筛选后续增强。

## 1. 模块职责

查看最近训练、成员筛选、动作筛选、历史最好表现、预估 1RM 和最近进阶建议。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `app/(tabs)/history.tsx` | 训练历史页，读取最近 session，展示个人记录、小组汇总和折线趋势卡片。 |
| `app/history/manual.tsx` | 补录过去训练。 |
| `app/history/[sessionId].tsx` | 查看某次训练详情，默认只读；顶部更多菜单进入编辑记录或删除整次训练。 |
| `app/history/group-exercise/[exerciseId].tsx` | 小组动作详情，支持卧推、深蹲、硬拉、肩推、划船、引体 / 下拉和其他动作，按本机训练记录汇总成员最好重量、容量、预估 1RM、最近有效组，并提供指标 / 时间范围 / 成员筛选和多成员趋势线。 |
| `src/domain/history/history-analysis.ts` | Epley 预估 1RM、个人趋势、小组汇总、成员贡献、PR 接近度、疲劳提示和中文建议。 |
| `src/components/ui/MiniLineChart.tsx` | 记录页、训练分析页和计划页共用的轻量折线趋势图。 |
| `src/components/history/SessionHistoryCard.tsx` | 最近训练卡片。 |
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
职责：支持周日期点击、月视图、训练日期红点、查看某天训练记录和进入详情；最近训练列表使用摘要卡展示标题、日期/时长、动作数、完成组数、总训练量、成员口径、PR/估算 1RM/趋势标签。  

文件：`app/history/manual.tsx`  
职责：选择日期、成员、动作、组数、重量、次数、完成情况，并保存到 SQLite。  

文件：`app/history/[sessionId].tsx`  
职责：展示日期、成员、动作、组数、重量、次数、完成情况、训练量和建议；默认只读，进入编辑态后支持修改历史记录，并通过更多菜单二次确认删除。

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
- 2026-06-14：最近训练列表改为紧凑摘要卡；空状态补充“去训练”入口；点击卡片进入 `app/history/[sessionId].tsx`，历史记录继续读取训练时快照。
- 2026-06-29：记录页新增个人 / 小组视角；小组汇总接入 `getGroupHistoryAnalysis()` 和本机 SQLite 训练详情；记录页、训练分析页、计划执行趋势统一改为折线趋势。
- 2026-06-30：历史详情页改为默认只读，编辑和删除收进顶部更多菜单；小组动作表现卡新增详情入口；`app/history/group-exercise/[exerciseId].tsx` 从 SQLite session 明细即时汇总成员对比和最近有效组，支持卧推、深蹲、硬拉、肩推、划船、引体 / 下拉和其他动作，并新增指标、时间范围、成员筛选和多成员趋势线。

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
职责：基于本机训练详情和本地成员列表生成小组总训练量、训练次数、完成率、成员贡献排行、近 7 天折线趋势、最近小组训练记录和小组洞察。  
调用方：`app/(tabs)/history.tsx`  
依赖：workout, member  
测试：`src/tests/history.test.ts`

修改注意：

1. 不要在页面组件中硬编码小组统计。
2. 只能基于 Repository 读取到的真实 SQLite 训练记录生成结果。
3. 未训练成员应显示为待开始，而不是填充假训练量。
