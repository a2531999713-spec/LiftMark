# Onboarding 模块概览

更新时间：2026-06-30

## 模块职责

Onboarding 模块负责新用户首次训练信息完善和推荐计划选择。它不直接写训练记录，只负责把用户资料写入成员档案，并把用户选择的系统方案复制为当前用户计划。

## 当前范围

- 单页四步流程：完善训练信息、训练目标与频率、训练基础、推荐计划。
- 推荐输入：目标、每周训练天数、训练经验、器械条件、可选基础力量。
- 推荐输出：主推荐计划和两个备选计划。
- 使用计划后：复制系统方案为用户计划，更新默认小组当前计划，跳转今日训练页。

## 主要文件

| 文件 | 说明 |
|---|---|
| `app/onboarding/training-profile.tsx` | 四步训练信息和推荐计划 UI。 |
| `src/domain/onboarding/trainingProfile.types.ts` | 训练信息草稿类型。 |
| `src/domain/plan/planRecommendation.ts` | 推荐计划匹配逻辑。 |
| `src/tests/plan-recommendation.test.ts` | 推荐规则单元测试。 |

