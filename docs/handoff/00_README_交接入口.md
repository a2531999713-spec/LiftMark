# 练刻 LiftMark 架构重构交接文档 v3

> 文件编码：UTF-8 with BOM  
> 文件名已改为英文，避免 Windows 解压后中文文件名乱码。  
> 本文档用于新开窗口交接给 Codex / GLM / 其他 AI 开发工具。

## 当前目标

### 2026-07-21 v2.11.0 状态

- `/achievements`、首页连续性卡、“我的”入口和训练总结后的新解锁 Sheet 已实现。
- 本地 Repository 从当前 `owner_user_id` 一次聚合有效训练、容量、周期、恢复记录与最近 12 周；无 N+1，离线可用。
- 服务端 `GET /api/achievements/me` 已改为统一口径、固定查询数量和批量事务 reconcile；seed 按 code 幂等更新 11 项目录并禁用旧日连续成就。
- 无 SQLite/PostgreSQL migration。API 与 seed 需要在合并后部署，部署前必须备份 PostgreSQL 并确认 PM2 状态。
- 自动化验证通过；NE2210 已完成只读入口、滚动、返回与无横向溢出验收。未在受保护 176 账号上制造训练记录。
- 详细交接：`13_achievement_continuity_2026-07-21.md`；架构：`../03-architecture/achievement-continuity-implementation-2026-07.md`。

### 2026-07-15 v2.10.0 状态

- `/recovery`、今日紧凑状态卡、六项评分、趋势与同日编辑已实现。
- 开始训练采用内存动作过滤；确认后只写新 session 快照和该 session 的未完成组重量。
- 小组成员状态独立保存；最保守状态只作为共享 session 调整建议，用户可拒绝。
- `RecoveryRepository` 使用当前 owner + 可见 group/member scope；本地成功后再后台同步。
- 没有 SQLite/PostgreSQL migration、API 或部署变更；每成员独立动作结构仍延期。
- 详细交接见 `12_recovery_readiness_2026-07-15.md`。

### 2026-07-15 v2.9.0 状态

- 推荐计划库与完整系统方案详情已经实现；入口为 `/plan/library` 与 `/plan/scheme/[schemeId]`。
- 8 套系统方案目录已对真实 seed 做结构化校验；预览使用批量处方读取。
- 系统方案必须复制为账号所属用户计划后才能激活；已有副本默认复用，复制激活会保证活动周期存在。
- 首次引导通过全屏覆盖层复用详情内容，关闭后保留表单草稿。
- 本轮没有移动端/后端 migration、API 或服务器部署，未触碰 176/188 数据。

本次不要继续围绕旧 Bug 打补丁，而是正式进行核心架构重构。

重构主线：

```text
账号作用域 → 小组 → 计划 → 计划周期 → 训练执行 → 训练报告 → 同步
```

动作库媒体资源暂不接入。  
健身动作 GIF / 第三方图片先全部取消实际接入，只保留接口、字段和扩展能力。

## 本次要解决的问题

1. 账号切换后数据不能串号。
2. 188 测试账号旧数据可以清空，不再抢救。
3. 176 主号服务器数据要保护，不能误删。
4. 首页、计划页、历史页、小组页必须有稳定空状态。
5. 计划必须支持周期、完成、归档和统计。
6. 训练提醒能做的先做，本地通知优先，服务端推送预留。
7. 每次训练结束生成训练报告。
8. 热量消耗做估算值，不做精确值。
9. 动作图片/GIF 不接入，但动作图标系统和媒体字段预留。
10. 后续动作图标采用“肌群 + 动作类型”的统一图标系统，而不是每个动作单独配 GIF。

## 文件说明

```text
00_README.md
01_current_status.md
02_core_architecture.md
03_plan_cycle_archive.md
04_reminder_notification.md
05_training_report_calorie.md
06_exercise_catalog_icon.md
07_codex_execution_task.md
08_validation_checklist.md
09_github_sync.md
10_first_message_for_new_window.md
LiftMark_refactor_handoff_full_v3.md
```

## 是否需要同步到 GitHub？

需要。

建议同步这些文档到仓库：

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
```

不要同步：

```text
.env
.pem
数据库备份
服务器密钥
阿里云密钥
临时截图
历史调试日志
zip 包
```
