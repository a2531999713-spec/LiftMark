# Exercise 模块概览

更新时间：2026-06-09

## 1. 模块职责

管理动作库、动作模式、器械、目标肌群和替代动作，支撑计划动作与训练中替换。

- Exercise 和 ExerciseAlternative 数据模型。
- 默认动作库与动作替换库 seed。
- 动作分类：胸推、垂直拉、水平拉、深蹲类、髋铰链、肩推、孤立动作等。
- 替代动作必须保持动作模式和训练目的尽量一致。

## 2. 非职责

- 不保存某次训练的替换结果，替换结果由 workout_exercise_records 保存。
- 不计算建议重量，只提供 referenceLift、equipment 等输入信息。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- 无直接领域依赖。

## 5. 被依赖模块

- plan
- workout
- progression
- history

## 6. 主要文件

Sprint 3 已创建默认动作 seed 和本地 Repository；以下路径按当前实现列出：

| 文件 | 说明 |
|---|---|
| `src/domain/exercise/exercise.types.ts` | 动作和替代动作类型。 |
| `src/data/seed/defaultExercises.ts` | 默认动作库和周五补弱菜单动作 seed。 |
| `src/data/seed/defaultAlternatives.ts` | 默认动作替换关系 seed。 |
| `src/data/repositories/exerciseRepository.ts` | 动作库 Repository 接口。 |
| `src/data/local/repositories/exerciseRepository.ts` | 动作库 Repository。 |

## 7. 核心数据结构

- Exercise
- ExerciseAlternative
- exercises
- exercise_alternatives

## 8. 修改风险

- 替换动作不能改变训练目的，例如飞鸟不能完全替代卧推主项。
- 器械被占时允许替换，但原计划动作必须保留为 replaced_from_exercise_id。

## 9. 需要人工确认的问题

- 动作分类和器械类型由 Excel 转 seed 时推断，后续需要人工校准精细分类。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
