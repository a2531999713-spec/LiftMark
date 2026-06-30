# Progression 模块实现文档

更新时间：2026-06-11  
对应代码目录：`training-partner-app/`；Sprint 1 已创建基础类型和 Repository 骨架，稳定性 Sprint 新增进阶建议中文展示映射。

## 1. 模块职责

训练完成后基于完成情况、失败次数和双进阶规则生成下次建议。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/progression/progression.types.ts` | 进阶建议类型。 |
| `src/domain/progression/progression.labels.ts` | 进阶建议中文 label 映射。 |
| `src/domain/progression/progression-engine.ts` | 增力/增肌建议引擎。 |
| `src/data/local/repositories/progressionRepository.ts` | 进阶建议 Repository。 |
| `src/tests/progression-engine.test.ts` | 进阶算法测试。 |

## 3. 核心类/函数

### getStrengthProgressionSuggestion()

文件：见主要文件列表  
符号：`getStrengthProgressionSuggestion()`  
搜索锚点：`getStrengthProgressionSuggestion()`  
职责：根据完成率 生成增力建议。  
调用方：history, workout-summary-flow  
依赖：workout, weight, exercise, member  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### getHypertrophyProgressionSuggestion()

文件：见主要文件列表  
符号：`getHypertrophyProgressionSuggestion()`  
搜索锚点：`getHypertrophyProgressionSuggestion()`  
职责：根据次数区间、动作质量生成增肌建议。  
调用方：history, workout-summary-flow  
依赖：workout, weight, exercise, member  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### ProgressionRepository.createSuggestionsForSession

文件：见主要文件列表  
符号：`ProgressionRepository.createSuggestionsForSession`  
搜索锚点：`ProgressionRepository`  
职责：训练完成后生成建议。  
调用方：history, workout-summary-flow  
依赖：workout, weight, exercise, member  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### formatProgressionSuggestionLabel()

文件：`src/domain/progression/progression.labels.ts`  
符号：`formatProgressionSuggestionLabel()`  
搜索锚点：`progressionSuggestionLabels`  
职责：把 `increase`、`maintain`、`decrease`、`deload`、`add_reps`、`maintain_or_decrease` 映射为中文展示文案。  
调用方：history, workout-summary-flow  
依赖：无  
测试：后续随 progression UI 增强补充。

## 4. 数据结构

- ProgressionSuggestion
- progression_suggestions

## 5. 调用关系

- 依赖：workout, weight, exercise, member
- 被调用：history, workout-summary-flow

## 6. 测试位置

- 全部完成且最近表现稳定 -> increase。
- 全部完成但近期压力偏高 -> maintain。
- 连续失败 2 次 -> deload。
- 4 组均达上限 -> increase；仍在区间 -> add_reps。

建议测试文件：

- `src/tests/progression.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 连续失败次数统计口径需要确认。
- 建议不得覆盖训练者手动记录，只能作为建议保存。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Progression 类型、Repository 接口和 SQLite 实现骨架已创建。
- 2026-06-11：同步稳定性与基础体验 Sprint：新增 `progression.labels.ts`，避免 UI 直接展示内部枚举。
