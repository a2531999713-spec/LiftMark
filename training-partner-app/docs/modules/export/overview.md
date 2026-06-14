# Export 模块概览

更新时间：2026-06-11

## 1. 模块职责

提供本地训练数据 JSON 导出、系统方案数据重置和清空测试数据等设置页能力。

- 本地 SQLite 数据导出 JSON。
- 训练记录单独导出 JSON。
- 当前用户计划导出为 `.liftmark.json` JSON。
- 设置页中的清空测试数据和重置系统方案数据入口。
- 后续 CSV/备份恢复能力预留。

## 2. 非职责

- 不实现云同步。
- 不改变训练记录原始数据。
- 不承担鉴权或订阅功能。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。

## 4. 依赖模块

- group
- member
- plan
- exercise
- workout
- progression
- recovery

## 5. 被依赖模块

- settings

## 6. 主要文件

Sprint 1 已创建基础领域、数据和页面占位骨架；以下路径按当前实现和后续计划合并列出：

| 文件 | 说明 |
|---|---|
| `src/services/exportService.ts` | JSON 导出服务、训练记录导出、默认 seed 重置。 |
| `src/services/planFileService.ts` | `.liftmark.json` 当前用户计划导出和导入校验。 |
| `app/(tabs)/settings.tsx` | 设置页入口。 |
| `src/data/local/repositories/settingsRepository.ts` | 轻量设置 Repository。 |

## 7. 核心数据结构

- SQLite tables
- JSON export payload

## 8. 修改风险

- 导出不能漏掉 workout_sets、progression_suggestions、recovery_logs。
- 清空测试数据必须有确认流程，避免误删真实训练记录。
- 计划文件不能导出个人 1RM 或训练记录。

## 9. 需要人工确认的问题

- Sprint 1 已创建基础路径；后续 Sprint 若新增/迁移文件，需继续与实际源码对齐。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
