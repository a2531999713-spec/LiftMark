# 首次使用流程

更新时间：2026-06-30

## 1. 流程目标

首次登录或离线进入 App 时 seed 系统方案和默认用户计划、创建默认小组，引导用户补充训练信息并选择推荐计划，最后进入今日训练页。

## 2. 参与模块

- group
- member
- plan
- exercise
- weight
- onboarding

## 3. 前置条件

- 本地 SQLite 可用。
- 系统方案和默认用户计划 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 打开 App，检测本地 SQLite 是否已有基础数据。
2. 没有本地数据时执行 `seedDefaultData`，写入默认动作、替换库、主流系统计划库和默认新手全身用户计划副本。
3. 创建默认小组，并绑定默认新手全身用户计划副本。
4. 引导用户补充昵称、性别、年龄、身高、体重、训练目标、每周训练天数、训练经验、器械条件和可选 1RM。
5. `recommendPlans()` 根据训练信息生成主推荐和备选方案。
6. 用户点击“使用此计划”后，Repository 复制系统方案为新的用户计划，并设为当前小组计划。
7. 进入今日训练页。

## 5. 数据读写

写入或重点影响：

- groups
- group_members
- member_profiles
- plan_templates
- plan_phases
- plan_days
- plan_exercises
- exercises
- exercise_alternatives

## 6. 异常与边界

- 跳过 1RM 时建议重量显示未设置。
- seed 失败时应提供重试和错误提示。
- 第一版本地默认小组最多 5 名成员；用户可以先添加 1 名成员并继续完善资料。
- 用户跳过 1RM 时，推荐计划仍可使用；建议重量会按成员档案缺失状态显示。
- 推荐计划失败时保留默认新手全身计划，用户仍可进入今日训练页。

## 7. 当前实现状态

- 已实现 `app/onboarding/training-profile.tsx` 训练信息完善和推荐计划选择。
- 成员基础资料写入 `group_members` 和 `member_profiles`。
- 推荐计划通过 `copySystemSchemeToUserPlan()` 复制为用户计划后更新默认小组当前计划。

## 8. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
