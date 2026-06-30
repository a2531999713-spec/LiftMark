# 项目文档中心

更新时间：2026-06-30

## 1. 文档目的

本目录用于记录“练刻 / LiftMark”多人健身训练 App 的产品定位、业务流程、技术架构、模块边界、数据库结构、Repository 接口、开发路径和 AI 开发规则。

当前仓库已创建 `training-partner-app/` 业务项目骨架。本套文档最初基于以下资料建立，并在 Sprint 开发后按代码同步更新：

- 多人健身训练 App 需求方案.docx
- 多人健身训练 App 开发文档 v1.0.docx
- 主流训练计划库与 legacy 四练 seed 资料

## 2. AI 开发阅读顺序

AI 在修改代码前，应按顺序阅读：

1. `docs/README.md`
2. `docs/project-overview.md`
3. `docs/development-roadmap.md`
4. `docs/ai-development-rules.md`
5. 与任务相关的模块文档
6. 与任务相关的流程、数据库或 API 文档
7. 与任务相关的源码

## 3. 文档目录说明

| 文档 | 用途 |
|---|---|
| `project-overview.md` | 项目整体说明、核心模块和已确认技术栈 |
| `product-design.md` | 产品定位、业务规则、页面结构和核心流程 |
| `technical-architecture.md` | React Native + Expo + SQLite 架构设计 |
| `development-roadmap.md` | Sprint 拆分、验收标准和版本路径 |
| `ai-development-rules.md` | AI 修改代码时必须遵守的项目规则 |
| `changelog.md` | 重要文档和代码变更记录 |
| `glossary.md` | 术语表 |
| `modules/` | 模块级职责、设计、原理、实现和测试计划 |
| `flows/` | 关键用户/系统流程 |
| `database/schema.md` | SQLite 表结构和约束说明 |
| `api/local-repository-api.md` | 本地 Repository 接口契约 |
| `adr/` | 架构决策记录 |

## 4. 核心原则

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 多人逻辑从第一版就保留。
- 本地 SQLite 优先。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。
- Excel 训练计划只整理为后续 seed 数据设计说明，不硬编码进页面组件。

## 5. 文档更新原则

代码变更后必须检查文档影响范围，只更新受影响的文档。

如无需更新文档，必须说明原因。

当文档和代码冲突时，以代码为准，并同步修正文档。

## 6. 最近审计

最近一次文档审计：

- 日期：2026-06-30
- 报告：系统计划库切换为主流可推荐方案；默认计划改为新手全身训练；首次训练信息完善、头像统一、小组动作详情和二级页标题清理已同步到相关文档。
