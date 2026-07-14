# LiftMark v2.9.0 推荐计划库与完整计划预览实现

日期：2026-07-15

## 范围

本轮只实现系统方案目录、完整只读详情、复制/激活/周期闭环和首次引导内预览。不修改动作图标、进阶建议、同步协议、后端 API 或服务器环境。

## 路由与组件

- `/plan/library`：只读取方案元数据，负责本地搜索、筛选、稳定排序和已复制标记。
- `/plan/scheme/[schemeId]`：加载单个方案真实结构，并提供复制、复制编辑、已有副本和明确重复复制动作。
- `SystemSchemeCard`：计划页与计划库共享的元数据卡。
- `SystemSchemeDetailContent`：独立详情路由与首次引导全屏覆盖层共享的只读内容。

## 数据读取

```text
schemeId
-> SystemTrainingScheme.templatePlanId
-> getPlanById + listPlanPhases + listPlanDays
-> listPlanExercisesForDays(dayIds) 一次批量查询
-> listExercisesByIds(exerciseIds) 一次批量查询
-> 按 week / phase / day 组成 SystemSchemePreview
```

计划库不加载模板详情。详情只加载当前方案。未知动作显示“未知动作 / 待补齐”，缺模板或空结构返回 `metadata_only`，不可用方案返回 `unavailable`，均不白屏。

## 目录校验

`validateSystemSchemeCatalog()` 返回结构化 issue，覆盖重复 scheme ID、缺 template ID、缺模板、缺 phase、缺 day、缺 plan exercise 和悬空 exercise ID。测试使用 8 套真实 seed 验证目录完整性。

## 复制与执行边界

```text
系统方案（只读）
-> 查找 originSchemeId 相同的账号所属用户副本
-> 默认复用；只有确认“再复制一份”才新建
-> copySystemSchemeToUserPlan（需要新副本时）
-> activateTrainingPlanForGroup
-> ensureActivePlanCycle
-> 计划页或用户副本编辑页
```

动作锁保证快速双击不会运行两次复制。数量限制只在确实创建新副本时检查。系统模板永远不直接成为 `activePlanId`。

## 账号与数据安全

- 模板读取继续通过 `getPlanAccountScope`，只允许系统模板或当前账号可见计划。
- 批量处方查询通过 `plan_days -> plan_templates` 再套账号作用域。
- 新计划与周期写入当前账号并进入原有同步队列。
- 不删除、不迁移、不重绑任何历史计划、训练、报告或 176/188 数据。

## 数据库与部署

- SQLite migration：无。
- PostgreSQL migration：无。
- 共享 DTO/API：无。
- 服务器部署：不需要。

## 验证

- 筛选、搜索、稳定排序、8 方案校验、时长估算。
- 批量读取、周分组、相同周结构、未知动作和元数据降级。
- 已有副本复用、明确重复复制、双击锁和 mainline 周期回归。
- 完整 Jest：46 套件 / 220 用例通过。

设备验收仍需验证计划库滚动、8 个详情、首次引导草稿、复制后计划页/首页与开始训练。
