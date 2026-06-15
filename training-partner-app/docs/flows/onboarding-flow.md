# 首次使用流程

更新时间：2026-06-09

## 1. 流程目标

首次打开 App 时 seed 系统方案和默认用户计划、创建默认小组、添加成员并进入今日训练页。

## 2. 参与模块

- group
- member
- plan
- exercise
- weight

## 3. 前置条件

- 本地 SQLite 可用。
- 系统方案和默认用户计划 seed 数据已按需初始化。
- UI 只触发流程，不承载核心业务规则。

## 4. 主流程

1. 打开 App，检测本地 SQLite 是否已有基础数据。
2. 没有本地数据时执行 seedDefaultData，写入默认动作、替换库、四练系统方案和默认用户计划副本。
3. 创建默认小组，并绑定默认用户计划副本。
4. 引导用户添加第一个成员。
5. 用户输入 1RM、体重和加重单位；可跳过 1RM。
6. 用户选择当前周期、当前周数和周五是否训练。
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

## 7. 当前实现状态

- Sprint 2 已实现成员列表、新增成员和编辑成员资料。
- 成员资料写入 `group_members` 和 `member_profiles`。
- Android 真机关闭重开后的持久化烟测仍待验证。

## 8. 文档同步要求

- 修改本流程涉及逻辑时，同步检查相关模块文档。
- 修改表结构时，同步 `docs/database/schema.md`。
- 修改 Repository 契约时，同步 `docs/api/local-repository-api.md`。
