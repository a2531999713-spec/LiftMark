# 项目文档中心

更新时间：2026-07-01

## 2026-07-01 本次补充

- 记录页动作筛选改为单一选择器：个人默认总训练量趋势，小组默认总览；选择动作后再进入动作趋势和成员对比。
- 历史详情支持个人口径隔离，个人入口只显示当前成员 set，小组入口显示全部成员。
- 图表 Y 轴缩放抽到共享 `chartScale`，覆盖真实刻度、共享多折线坐标、等值和零值。
- 训练休息面板合并为一个开始下一组动作，并保存 `actual_rest_seconds`；无建议重量的新动作可直接输入并完成，后续组 / 后续 session 可复用最近实际重量。
- 登录页恢复手机号 / 练刻 ID 密码登录与短信验证码登录 / 注册双模式。
- 后端注册写入服务端生成 `registration_seq`、`registered_at`、`registration_source`、`campaign_code`、`early_user_tier`；SQLite migration v11 修复旧库 `group_members.avatar_url`。

## 2026-06-30 本次补充

- 架构方向更新：云端 PostgreSQL 是主数据源，本地 SQLite 是缓存、副本和弱网训练保障；移动端写入后进入 `local_sync_queue`，由 `src/sync/syncService.ts` 推送到 `/api/sync/push`。
- 训练执行 P0 修复：小组按“同一动作内 set number 优先、成员顺序其次”轮换；完成一组必须先校验并保存当前 set，保存失败不会推进到下一组或下一动作。
- 训练结束保护：完成动作少、完成组少、时长少、总量为 0 或大部分动作未完成时，保存前弹出继续训练 / 保存记录 / 放弃本次确认。
- 个人记录页改为分析导向：顶部概览、趋势、动作筛选、日历当天记录和训练查询；不再以近期训练流水列表作为主模块。
- 成员表单删除解释区，保存按钮按变更和校验状态启用；图表横轴在组件层自动抽样，避免手机窄屏标签堆叠。
- 图表系统修复：折线图增加真实 Y 轴、单位、绘图区 padding、空状态和周起始日期标签。
- 我的页二级页面统一 `SecondaryPageHeader`，并修复账号头像同步当前训练成员头像的问题。
- 训练记录增强：RPE、备注、实际休息秒数、休息面板和训练中替换动作。
- 小组支持创建和当前小组切换；小组记录默认总览，动作分析来自真实练过的 `exerciseId`。
- 新增身体数据模块文档：`docs/modules/body-metrics/overview.md`、`design.md`、`implementation.md`、`test-plan.md`。

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
- 云端优先，本地 SQLite 作为缓存与离线副本。
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
- 报告：图表系统、身体数据、多小组、头像链路、小组记录总览、RPE/休息面板和训练中替换动作已同步到相关文档。
