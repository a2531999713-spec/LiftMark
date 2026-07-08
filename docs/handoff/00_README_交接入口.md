# 练刻 LiftMark 架构重构交接文档 v3

> 文件编码：UTF-8 with BOM  
> 文件名已改为英文，避免 Windows 解压后中文文件名乱码。  
> 本文档用于新开窗口交接给 Codex / GLM / 其他 AI 开发工具。

## 当前目标

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
