# LiftMark (练刻) 更新日志

> 本文档记录项目的每次提交和版本升级内容。

---

## v1.1.0 - 2026-06-15 (远程最新)

---

### `710dec7` - 2026-06-15 15:47

**Fix image source path in README.md**

- 修复 README 中图片路径

### `b974634` - 2026-06-15 15:47

**Fix image source path in README.md**

- 修复 README 中图片路径

### `7154cea` - 2026-06-15 15:45

**Update image source path in README.md**

- 更新 README 中图片路径

### `d13d520` - 2026-06-15 15:44

**Revise README for clarity and feature updates**

- **1 file changed** | +122 / -44
- 重写 README，优化文案和功能介绍

### `40b19bb` - 2026-06-15 15:42

**Add initial README.md for LiftMark project**

- **1 file changed** | +65
- 新增项目 README.md

---

## v1.0.0 - 2026-06-14 ~ 2026-06-15

---

### v1.0.5 - 2026-06-15 23:38

**`0f594df` feat: refine history analytics and manual logging**

- **78 files changed** | +1313 / -351

主要更新：
- 优化历史分析和手动记录功能
- 更新品牌图标和启动画面资源（Android 各分辨率图标重新设计）
- 重构 `history/manual.tsx`，大幅增强手动记录体验
- 优化训练记录页 `workout/[sessionId].tsx` 交互逻辑
- 新增 `planProgression.ts` 训练进度分析模块
- 新增 `recordingMode.ts` 记录模式定义
- 更新运动计划和运动类型定义
- 完善各模块设计文档和实现文档

---

### v1.0.4 - 2026-06-15 15:37

**`458bf3e` feat: redesign history analytics experience**

- **13 files changed** | +1886 / -533

主要更新：
- 全新历史分析界面（`history/analytics.tsx` 新增 633 行）
- 重构历史列表页 `history.tsx`
- 新增 `history-analysis.ts` 分析引擎（381 行）
- 新增历史分析测试用例
- 更新 README 和项目文档

---

### v1.0.3 - 2026-06-15 14:27

**`b169b2f` feat: refine plan management and exercise taxonomy**

- **42 files changed** | +1481 / -359

主要更新：
- 优化训练计划创建流程 `plan/create.tsx`（+404 行重构）
- 改进运动选择器 `ExercisePickerSheet.tsx`（+295 行重构）
- 新增成员头像组件 `MemberAvatar.tsx`
- 扩展运动分类体系和数据库迁移脚本
- 完善运动仓库和成员仓库的查询能力
- 新增运动、成员、计划相关测试

---

### v1.0.2 - 2026-06-15 10:42

**`e3628bb` feat: expand exercise library and plan management**

- **74 files changed** | +4528 / -1783

主要更新：
- 大幅扩展运动库和计划管理功能
- 新增 `ExercisePickerSheet.tsx` 运动选择器组件（501 行）
- 新增 `AppModalSheet.tsx` 模态弹窗组件
- 重构计划页 `plan.tsx`（+1086 行重构）
- 重构探索页 `explore.tsx`（+488 行）
- 重构设置页 `settings.tsx`（+222 行）
- 更新默认运动数据 `defaultExercises.ts`
- 新增体重计算器逻辑优化
- 新增计划仓库测试和计划测试
- 更新启动画面和品牌资源

---

### v1.0.1 - 2026-06-15 00:28

**`e9e3066` fix: refine settings history and plan switching**

- **72 files changed** | +2449 / -314

主要更新：
- 新增 Android 原生构建配置（`android/` 目录完整初始化）
- 优化设置页和历史记录页
- 新增成员单位设置页 `member-units.tsx`
- 新增成员管理页 `members.tsx`
- 新增经典 PPL 训练计划模板 `classicPplPlan.ts`
- 新增计划文档服务和计划仓库功能
- 完善数据库 schema 和 API 文档

---

### v1.0.0-alpha.3 - 2026-06-15 00:25

**`9bb9d3a` Restore ai-doc-driven-development folder**

- **72 files changed** | +2449 / -314

主要更新：
- 恢复 AI 文档驱动开发文件夹
- 新增 Android 原生构建配置（`android/` 目录）
- 新增 Kotlin 入口文件（`MainActivity.kt`, `MainApplication.kt`）
- 新增 Android 图标和启动画面资源
- 更新 `.gitignore` 规则

---

### v1.0.0-alpha.2 - 2026-06-14 23:25

**`a347182` Clean up root directory: remove all residual files, keep only training-partner-app/**

- **308 files changed** | -46899

主要更新：
- 清理根目录，移除冗余文件，保留 `training-partner-app/` 作为项目根目录
- 移除根目录下的源代码、配置文件、文档等
- 统一项目结构

---

### v1.0.0-alpha.1 - 2026-06-14 22:14 ~ 23:05

**仓库结构调整阶段**（6 次提交）

| 提交 | 说明 |
|------|------|
| `288bb34` | 仅保留 training-partner-app/ 目录，移除根目录源码 |
| `945dcb1` | 将源码移至根目录，整理项目结构 |
| `69c05d5` | 清理临时文件，恢复项目结构 |
| `f62a5b5` | 恢复原始项目结构，源码移回 training-partner-app/ |
| `ae96eff` | 清理临时文件，更新 .gitignore |
| `ba393c8` | 将文件移至根目录 |

---

### v1.0.0-alpha.0 - 2026-06-14 22:14

**`d917f73` Update README with correct repository URL**

- 更新 README 中的仓库链接

---

### v1.0.0-alpha.0 - 2026-06-14 20:38

**`574c6e4` Initial commit: LiftMark (练刻) training partner app**

- 项目初始化
- 包含完整的训练伙伴应用源码、文档、资源
- 技术栈：React Native + Expo + SQLite
- 功能模块：训练记录、计划管理、历史分析、运动库、成员管理、设置
