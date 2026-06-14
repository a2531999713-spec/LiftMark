# Group 模块概览

更新时间：2026-06-09

## 1. 模块职责

管理默认训练小组、当前计划、当前周期、当前周数和周五补弱开关。

- 默认小组创建和读取。
- 小组 activePlanId、currentPhaseType、currentWeek、fridayEnabled。
- 小组内多人训练的边界和未来 owner/coach/member/guest 角色预留。

## 2. 非职责

- 不保存成员 1RM 细节。
- 不保存训练每组记录。
- 不实现云端邀请和二维码加入，第一版只预留字段和 Repository 边界。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- plan

## 5. 被依赖模块

- member
- today-training-flow
- workout
- export

## 6. 主要文件

Sprint 1 已创建基础领域、数据和页面占位骨架；以下路径按当前实现和后续计划合并列出：

| 文件 | 说明 |
|---|---|
| `src/domain/group/group.types.ts` | Group 类型定义。 |
| `src/data/local/repositories/groupRepository.ts` | 默认小组 Repository。 |
| `src/store/selectedGroupStore.ts` | 最近选中小组状态。 |
| `app/(tabs)/settings.tsx` | 小组设置入口。 |

## 7. 核心数据结构

- Group
- groups

## 8. 修改风险

- 第一版即使只有一个默认小组，也不能把 UI 和数据结构做成单人逻辑。
- currentWeek 和 currentPhaseType 必须与 plan phase 范围保持一致。

## 9. 需要人工确认的问题

- Sprint 1 已创建基础路径；后续 Sprint 若新增/迁移文件，需继续与实际源码对齐。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
