# Exercise 模块实现文档

更新时间：2026-06-15  
对应代码目录：`training-partner-app/`；当前已导入扩展系统动作库、动作替换 seed，并新增自定义动作本地 Repository 能力。

## 1. 模块职责

管理动作库、动作模式、器械、目标肌群和替代动作，支撑计划动作与训练中替换。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/exercise/exercise.types.ts` | 动作和替代动作类型。 |
| `src/data/seed/defaultExercises.ts` | 扩展后的系统动作 seed，覆盖胸、背、肩、腿、手臂、核心、热身/有氧等。 |
| `src/data/seed/defaultAlternatives.ts` | 从 Excel 动作替换库提取的替代动作 seed。 |
| `src/data/seed/seedDefaultData.ts` | 将动作库和替换关系幂等写入 SQLite。 |
| `src/data/repositories/exerciseRepository.ts` | 动作库 Repository 接口。 |
| `src/data/local/repositories/exerciseRepository.ts` | 动作库 Repository。 |
| `src/components/exercises/ExercisePickerSheet.tsx` | 统一动作选择器和快速新建自定义动作弹层。 |

## 3. 核心类/函数

### ExerciseRepository.listAlternatives

文件：见主要文件列表  
符号：`ExerciseRepository.listAlternatives`  
搜索锚点：`ExerciseRepository`  
职责：按原动作查找可替代动作。  
调用方：plan, workout, progression, history  
依赖：无直接领域依赖  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### ExerciseRepository.listExercisesByIds

文件：见主要文件列表  
符号：`ExerciseRepository.listExercisesByIds`  
搜索锚点：`ExerciseRepository`  
职责：按计划动作的 `exercise_id` 批量读取动作元数据。  
调用方：today-training-flow, plan, workout  
依赖：无直接领域依赖  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### ExerciseRepository.listExercises

职责：按搜索词、来源、肌群、器械和动作模式筛选动作库。  
调用方：历史补录、计划创建、训练自由动作入口。  
注意：列表页或选择器不得绕过 Repository 直接拼 SQL。

### ExerciseRepository.createCustomExercise

职责：创建本机用户自定义动作，`source` 固定为 `custom`，按名称做本地去重。  
调用方：统一动作选择器。  
注意：快速新建只要求名称、主要肌群、器械和备注；不要在第一版强制图片/GIF/视频。

## 4. 数据结构

- Exercise
- ExerciseAlternative
- exercises
- exercise_alternatives

当前 seed 文件包含：

- `defaultExercises.ts`：100+ 个系统 `ExerciseSeed`，写入并按 ID 幂等更新 `exercises`。
- `defaultAlternatives.ts`：36 条 `ExerciseAlternative`，写入 `exercise_alternatives`。

系统动作 seed 会修复历史编码污染的中文动作名；用户自定义动作不会被 seed 覆盖。计划导入时会按动作名称复用本机已有动作，缺失动作才新增，避免重复导入自定义动作。

## 5. 调用关系

- 依赖：无直接领域依赖
- 被调用：plan, workout, progression, history

## 6. 测试位置

- 动作替换库能按原动作返回替代项。
- 今日训练能按 `exercise_id` 读取动作名和器械类型。
- 替换后历史记录保留原动作和新动作。
- 无替代动作时 UI 给出空状态。
- 补录和计划创建都能通过统一选择器选择系统/自定义动作。
- 快速新建自定义动作后可立即选入补录或计划。

建议测试文件：

- `src/tests/exercise.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 替换动作不能改变训练目的，例如飞鸟不能完全替代卧推主项。
- 器械被占时允许替换，但原计划动作必须保留为 replaced_from_exercise_id。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Exercise 类型和 SQLite 表结构已创建，动作库完整 seed 暂未导入。
- 2026-06-09：同步 Sprint 3：Excel 动作库、周五补弱菜单动作和替换库已导入 SQLite seed，新增 ExerciseRepository SQLite 实现。
- 2026-06-09：同步 seed 拆分：移除合并 generated seed，动作和替换关系拆分为 `defaultExercises.ts`、`defaultAlternatives.ts`。
- 2026-06-10：同步 Android development build 调整：动作库和替代关系继续通过 native SQLite seed 初始化；Web 预览不是当前验收标准，不为 Web 报错改动动作数据层。
- 2026-06-10：同步 Gradle/JDK toolchain 修复：动作 seed 未改动；native build 使用 JDK 17。
- 2026-06-10：同步本地 Android 预览 APK 流程：动作库和替代动作 seed 未改动；本地 release APK 首屏已能展示默认计划动作，后续替换弹层在 Sprint 5 中继续实现。
- 2026-06-15：扩展系统动作库为 100+ 正确中文动作；新增 `exercises.source`、自定义动作创建、统一动作选择器，并接入历史补录和计划创建。
