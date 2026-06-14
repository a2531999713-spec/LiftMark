# History 模块实现文档

更新时间：2026-06-11  
对应代码目录：`training-partner-app/`；历史页已展示最近训练和基础趋势推算，复杂筛选和图表后续增强。

## 1. 模块职责

查看最近训练、成员筛选、动作筛选、历史最好表现、预估 1RM 和最近进阶建议。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `app/(tabs)/history.tsx` | 训练历史页，读取最近 session 并展示趋势卡片。 |
| `app/history/manual.tsx` | 补录过去训练。 |
| `app/history/[sessionId].tsx` | 查看并编辑某次训练详情。 |
| `src/domain/history/history-analysis.ts` | Epley 预估 1RM、最近 5 次趋势、PR 接近度、疲劳提示和中文建议。 |
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
职责：支持周日期点击、月视图、训练日期红点、查看某天训练记录和进入详情。  

文件：`app/history/manual.tsx`  
职责：选择日期、成员、动作、组数、重量、次数、RPE/RIR，并保存到 SQLite。  

文件：`app/history/[sessionId].tsx`  
职责：展示日期、成员、动作、组数、重量、次数、RPE/RIR、训练量和建议；支持编辑历史记录和二次确认删除。

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
