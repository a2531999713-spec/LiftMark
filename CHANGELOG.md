# LiftMark (练刻) 更新日志

> 本文档记录项目的每次提交和版本升级内容。

---

## v1.2.0 - 2026-06-22

---

### `5b00e0e` - 2026-06-22 feat: 训练执行页全面重构 + 多处UI优化

- **26 files changed** | +5753 / -1188

#### 训练执行页 (`app/workout/[sessionId].tsx`)
- **顶部导航栏重构**：深色背景 → 浅色背景，关闭按钮 → 返回箭头，居中标题 → 左侧标题+副标题（"训练中" / "增力阶段 · 第 3 周 · Day 2"），更多选项 → 红色文字按钮"结束训练"
- **移除旧进度条**：删除 progressPanel/progressInfo/progressTrack 样式
- **整体主题色切换**：safeArea 背景从 `colors.dark` 改为 `colors.background`；errorContainer/emptyContainer 背景从 `darkCard` 改为 `surface`；restCard 背景从 `darkCard` 改为 `surface`；bottomBar 背景从 `dark` 改为 `surface`，边框从半透明白改为 `colors.border`
- **布局重排**：StatsBar → HeroCard → MemberStrip → CurrentSetRecorder → RestCard → CompletedSetList → RotationOrder → ProgressStrip
- **成员轮换**：新增 `activeMemberId` 状态，`onSelectMember` 接线为 `setActiveMemberId(id)`
- **移除底部重复按钮**：删除底部栏重复的"完成本组"按钮（CurrentSetRecorder 中已有）
- **新增"上一个动作"按钮**：替换底部栏的"跳过"占位按钮
- **移除休息卡片中的独立"跳过休息"按钮**：只保留 CurrentSetRecorder 中的动态按钮

#### 记录卡片 (`src/components/workout/CurrentSetRecorder.tsx`)
- **左右分栏布局**：左侧重量/次数输入，右侧 RPE/RIR 选择器
- **主按钮和跳过按钮并排显示**：flex:2 + flex:1 布局
- **按钮尺寸和间距优化**：stepperButton 48→44，stepperInput fontSize 18→17

#### 训练进度条 (`src/components/workout/WorkoutProgressStrip.tsx`)
- **新增 dock 模式**：紧凑进度条+动作列表，适用于底部固定栏
- **允许点击未开始的动作切换**：移除 `isUpcoming` disabled 限制

#### "我的"页面 (`app/(tabs)/settings.tsx`)
- **Banner 背景色**：从深色 `#1A2332` 改为浅色 `surfaceMuted`
- **Logo 切换**：使用 `logoLightCard` 适配浅色背景
- **Icon 对比度提升**：5 个 SettingsCell 的 `iconBg` 从 `surfaceMuted` 改为 `accentSoft`
- **Chevron 颜色**：从 `textSubtle` 改为 `textMuted`

#### 记录页 (`app/(tabs)/history.tsx`)
- **新增训练分析入口**：QuickActions 新增"训练分析"按钮，点击跳转 `/history/analytics`

#### 分析页 (`app/history/analytics.tsx`)
- **修复 header 显示**：移除 `useEffect` header hack，改为 layout 中 `headerShown: false`
- **移除 "History / Analytics" 文字**：只保留"训练分析"标题

#### 根布局 (`app/_layout.tsx`)
- **新增 analytics 路由**：`<Stack.Screen name="history/analytics" options={{ headerShown: false }} />`

#### 主题系统 (`src/theme/*`)
- **colors.ts**：新增/调整多个颜色 token
- **radius.ts**：圆角值微调
- **shadows.ts**：阴影样式适配浅色卡片

#### 品牌资源 (`src/assets/brand/index.ts`)
- **新增 `logoLightCard`**：浅色背景 Logo 变体

#### 新增组件
- `src/components/workout/CompletedSetList.tsx` - 已完成组列表（支持编辑/删除）
- `src/components/workout/CurrentSetRecorder.tsx` - 当前记录卡片
- `src/components/workout/ExerciseHeroCard.tsx` - 动作 Hero 卡片
- `src/components/workout/GroupMemberStrip.tsx` - 成员轮换条
- `src/components/workout/RotationOrderCard.tsx` - 轮换顺序卡片
- `src/components/workout/WorkoutProgressStrip.tsx` - 训练进度条
- `src/components/workout/WorkoutStatsBar.tsx` - 训练统计条
- `src/components/workout/WorkoutHeader.tsx` - 训练页头部

#### 构建配置
- **新增 `metro.config.js`**：支持 `@/` 别名打包
- **新增 `@react-native-community/cli` 依赖**

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

## v1.1.0 - 2026-06-17 ~ 2026-06-22

---

### `250f8ee` - 2026-06-22 fix: 训练分析header修复 + 首页仪表盘重设计

- 修复 analytics 页面 header 显示问题
- 首页仪表盘布局优化

### `46715ee` - 2026-06-22 feat: 全面UI重新设计 + 功能修复 + skills设计规范应用

- 应用 taste-skill / impeccable 设计规范
- 多处 UI 组件优化

### `b5e6cc6` - 2026-06-18 feat: 新增MiniLineChart组件、更新日志、训练计划和设计参考资源

- 新增 `MiniLineChart` 迷你折线图组件
- 新增训练计划 JSON 文件
- 新增设计参考图片资源

### `a732e73` - 2026-06-17 feat: UI全面重新设计 - 4Tab布局、主题系统优化、训练页简化

- 4Tab 布局重构（首页/计划/记录/我的）
- 主题系统全面优化
- 训练页交互简化

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
