# Plan 模块实现文档

更新时间：2026-07-08
对应代码目录：`training-partner-app/`

## 2026-07-08 管理计划面板重设计与最近训练图表改造

- `app/(tabs)/plan.tsx` 管理计划弹窗按用户设计方案重构：
  - 「我的计划」标题旁新增 ⋮ 更多操作按钮（Pressable），点击弹出 `AppModalSheet`（position=center）的「更多操作」菜单，包含「新建空白计划」「导入计划」两个 `PlanActionRow`。
  - 当前计划高亮显示：⭐ 图标 + 「当前」徽章；当前计划提供「编辑 / 分享」按钮，非当前计划提供「设为当前 / 编辑 / 分享 / 删除」按钮。
  - 移除 `QuickActionButton` 组件定义和 `quickActionsCard` / `quickActionsRow` / `quickActionButton` / `emptyActions` 样式；快捷操作三按钮（计划库 / 新建 / 导入）功能由「更多操作」菜单 + 「探索更多」区域承担。
  - 新增 `sectionTitleRow` 样式用于「我的计划 (N 个)」标题与 ⋮ 按钮的横向布局；`sectionHeader` 改为 `space-between`。
  - 「探索更多」区域展示前 3 个可用系统方案（`availableSchemes.slice(0, 3)`，原为 slice(0, 2)），超过 3 个时显示「查看全部 N 个方案 →」按钮跳转计划库弹窗。
  - 空状态文案改为引导用户使用右上角更多操作或下方系统方案，移除原「浏览计划库 / 创建计划」按钮。
- `app/(tabs)/plan.tsx` 「最近执行」改名「最近训练」，副标题改为「最近 6 次训练量与完成组数」。
  - `buildLastFourWeeks` 重命名为 `buildRecentSessions`，返回 `recentSessionsVolume`（柱：训练量 kg）、`recentSessionsCompletedSets`（折线：完成组数）、`recentSessionsLabels`（每次训练日期）、`recentSessionDate`。
  - 数据获取从「按自然周聚合最近 4 周」改为「最近 6 个完成训练 session」（`completedDetails.slice(-6)`），避免周一没数据时图表空白。
  - 训练 session 查询窗口从 `addDays(new Date(), -27)` 扩展到 `addDays(new Date(), -89)`，确保能拿到 6 次训练。
  - StatTile 文案改为「本周训练 / 本周组数 / 本周训练量」，与图表「最近训练」语义区分。
  - `PlanDashboardStats` 类型字段 `lastFourWeeksSessions` / `lastFourWeeksVolume` / `lastFourWeekLabels` 替换为 `recentSessionsCompletedSets` / `recentSessionsVolume` / `recentSessionsLabels`；`emptyStats` 对应改为空数组。
  - 移除不再使用的 `getNaturalWeekStart` 函数。
- `src/components/ui/MiniBarLineChart.tsx` 改造：
  - 新增 `showYAxis` prop（默认 false）：因训练量（kg）与组数量纲不同，默认不显示 Y 轴刻度，避免视觉干扰；传入 `showYAxis` 时才渲染左侧 Y 轴和对应 `axisSpacer`。
  - `ChartArea` 新增 `activeIndex` state（`number | null`），点击柱子或折线点切换选中；选中时显示数值气泡，再次点击关闭。
  - 柱子从 `View` 改为 `Pressable` 包裹（`barTouchable` 样式），选中时使用 `barActive` 样式（`brandDark` 色 + 透明度 0.88）。
  - 折线点 `onPress` 改为切换 `activeIndex`，选中时使用 `lineDotActive` 样式（放大到 12x12）。
  - 移除 `getDefaultKeyPointIndexes` 函数和 `barKeyIndexes` / `lineKeyIndexes` Set（不再使用关键点常显）。
  - 柱宽比从 0.55 调整为 0.5，适配 6 个数据点。
  - `renderLine` 函数签名新增 `activeIndex` 和 `setActiveIndex` 参数。
- `app/(tabs)/plan.tsx` 修复分享计划错误：`sharePlan` 中使用了 `FileSystem.documentDirectory` / `writeAsStringAsync` / `deleteAsync`，但未导入 `expo-file-system`。
  - 新增 `import * as FileSystem from 'expo-file-system/legacy'`，与项目其他模块（avatarUploadService、planDocumentService）保持一致的 legacy 导入方式。
- `app/(tabs)/plan.tsx` 移除传给 `VisualHeroCard` 的不存在 prop `actionIconSize={22}`（`VisualHeroCard` 组件未声明该 prop，TypeScript 之前会报错）。
- 新增 `WorkoutSessionDetail` 类型导入（来自 `@/domain/workout/workout.types`），用于 `buildRecentSessions` 函数签名。

## 2026-07-07 补充（二）：编辑计划页面与仪表盘重设计

- `app/_layout.tsx` 为 `plan/edit/[planId]`、`plan/create` 路由补充标题（`编辑计划` / `创建计划`），并用 `GestureHandlerRootView` 包裹 `Stack` 以支持长按拖拽手势。
- `src/components/plan/PlanEditOverview.tsx` 完全重写：
  - 顶部「计划概览」改为单行紧凑布局（计划名称 `flex:1` + 周期/频率紧凑字段 + 目标横向滚动）。
  - 训练日新增周几选择器（一二三四五六日 chip，点击设置 `weekday`）；活动训练日支持内联编辑 `focus` / `title`。
  - 训练日列表用嵌套 `ScrollView`（`nestedScrollEnabled`、`maxHeight: 320`）支持纵向滑动，超出部分可滑出；周次 tab 横向滑动。
  - 「复制到下一周」「添加训练日」从按钮改为图标（`copy-outline` / `add-circle-outline` 圆形品牌色背景）。
  - 删除「调整顺序」按钮，训练日与训练动作均改用 `DraggableRow`（`Gesture.Pan().activateAfterLongPress(350)` + `Gesture.Race(pan, tap)`）实现长按拖拽排序，点击切换激活。
- `app/plan/edit/[planId].tsx` 新增返回退出保存提示：监听 `navigation.beforeRemove`，通过 `serializeDraftForDiff` 与基准 draft 对比判断 dirty，未保存时弹 `Alert`「放弃修改 / 继续编辑」。
- `app/(tabs)/plan.tsx` 「本周执行」卡片重命名为「最近执行」，副标题改为「最近 4 周训练量与完成训练」，避免周一没数据时显示突兀。
- 新建 `src/components/ui/MiniBarLineChart.tsx` 柱状图+折线图组合组件：柱子表示训练量（品牌色），折线表示完成训练次数（accent 色），关键点显示数值气泡（品牌色/accent 色背景白字 + 阴影），符合图表样式约定。
- `buildLastFourWeeks` 同步返回 `lastFourWeeksSessions` 与 `lastFourWeeksVolume` 两个序列；`MiniLineChart` 在计划页被 `MiniBarLineChart` 替换。
- StatTile 缩小：`minHeight: 56 → 44`，`padding` 改为横 `spacing.sm` / 纵 `spacing.xs`，`gap: 2 → 1`。
- 去除「上一周 / 下一周」按钮及其 `saveWeek` / `clampPlanWeek` 实现；保留 `setCurrentPlan` 等其他流程。
- `VisualHeroCard` 新增可选 `actionIcon` / `onActionPress` props：传入后顶部右上角 `iconBubble` 变为可点击按钮。计划页用 `actionIcon="settings-outline"` + `onActionPress={() => setManageVisible(true)}` 替代原「管理计划 / 编辑当前计划」两个按钮，点击弹出管理计划弹窗；「编辑当前计划」入口收回管理弹窗内（既有 `PlanActionRow` 已支持）。

## 2026-07-07 补充：计划编辑器周视图和当前小组作用域

- `app/(tabs)/plan.tsx` 改为通过 `selectedGroupStore` 读取当前小组；切换小组后当前计划、当前周、本周安排和执行统计都会跟随刷新。
- `src/components/plan/PlanEditOverview.tsx` 将训练日列表改为“训练周 Tab + 当前周训练日列表”，列表固定高度并支持内部滚动，避免八周所有训练日一次性铺满页面。
- “复制到下一周”已从占位提示改成真实草稿操作：复制当前周训练日和动作到下一周，并替换目标周已有草稿。
- “调整顺序”已从占位提示改成排序模式，可调整当前周训练日顺序和当前训练日内动作顺序（注：本次已被「长按拖拽」替代，详见上方「2026-07-07 补充（二）」）。
- 计划概览不再用加减按钮调整周期和频率；计划名称输入区域更宽，周期/频率使用紧凑数字输入。
- 计划动作行去掉“手动重量”显示，为动作名称留出空间；动作序号按 A/B/C/D 循环使用不同颜色。

## 2026-07-01 补充：计划首页瘦身、详情操作菜单和用户计划编辑

- `app/(tabs)/plan.tsx` 保留当前计划、执行统计、本周安排和收纳式操作入口，不再在首页重复展示“我的计划”摘要或计划库入口。
- 当前计划 Hero 直接提供“切换计划”和“编辑计划”；操作弹层拆出“切换当前计划”“编辑当前计划”和“主流计划库”，避免关键操作只藏在“管理全部计划”中。
- 本周执行折线图按自然周周一作为周起始日期，每 7 天一个点；数据不足一个月时从最早有效训练所在周开始靠左展示，最多保留最近 4 个周点。
- `app/plan/[planId].tsx` 右上角更多按钮打开操作菜单，包含编辑计划、去训练和计划结构提示。
- `app/plan/create.tsx` 支持创建多个训练日，并通过 `editPlanId` 编辑用户计划。
- `PlanRepository.updateUserPlan()` 只允许编辑用户计划，会替换 template、phase、day 和 plan exercise 结构，不触碰训练记录表。
- `CreateUserPlanDayInput.week` 支持为不同训练日设置独立周次，便于后续扩展多周计划。

## 1. 当前实现概览

本次计划模块调整后，系统方案和用户计划分离：

- 系统方案目录位于 `src/domain/plan/systemSchemes.ts`。
- 当前可选系统方案以主流训练计划为主：新手全身、Push Pull Legs、经典四分化、上肢 / 下肢、5x5、减脂保肌、恢复训练和居家哑铃。
- 首次 seed 会生成一份默认用户计划 `plan_user_beginner_full_body_default`，并让默认小组当前计划指向这份用户计划。
- 旧四练模板继续写入本地 seed 用于历史兼容，但 `listSystemTrainingSchemes()` 和 `listUserPlans()` 不再把它作为用户可选计划展示。
- 首次登录后的训练信息完善页使用 `recommendPlans()` 基于目标、频率、经验和器械条件推荐方案，并把用户选择复制为当前用户计划。
- 用户点击“使用此方案”时，Repository 复制系统模板的 phases、days、plan_exercises，生成新的用户计划。
- 导入 `.liftmark.json` 时，页面通过 `planDocumentService` 选择文件并调用 `PlanRepository.importUserPlan()` 写入 SQLite。
- 计划页当前为精简仪表盘结构：当前计划、执行统计、本周安排和计划操作弹层；系统方案只在计划库弹层中展开。
- 用户计划可在“管理全部计划”弹层中删除；系统方案、当前计划和最后一个用户计划会被 Repository 阻止删除。
- 创建计划页接入统一动作选择器，可添加系统动作或快速新建自定义动作，并支持多训练日创建与用户计划编辑。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/plan/plan.types.ts` | `PlanTemplate.source` 增加 `system_copy`、`blank_created`、`duplicated`，并增加 `originSchemeId`。 |
| `src/domain/plan/systemSchemes.ts` | 本地系统方案目录和目标/难度中文 label。 |
| `src/domain/plan/planCopy.ts` | `createUserPlanCopyDraft()` 纯函数，复制系统模板为用户计划草稿。 |
| `src/data/repositories/planRepository.ts` | `PlanRepository` 支持用户计划列表、复制系统方案、导入、编辑和删除用户计划。 |
| `src/data/local/repositories/planRepository.ts` | SQLite 实现用户计划列表、系统方案复制、导入、编辑、删除和今日训练读取。 |
| `src/data/local/migrations.ts` | v2 `plan_system_scheme_origin` 补 `origin_scheme_id` 并迁移旧默认当前计划。 |
| `src/data/seed/mainstreamPlans.ts` | 主流系统计划 seed 和默认新手全身用户计划复制源。 |
| `src/data/seed/defaultStrengthPlan.ts` | legacy 四练模板 seed，仅用于兼容历史数据。 |
| `src/data/seed/classicPplPlan.ts` | “经典三分化 PPL”系统模板 seed。 |
| `src/data/seed/seedDefaultData.ts` | 写入系统模板和默认用户计划副本。 |
| `src/domain/plan/planRecommendation.ts` | 训练信息到推荐计划的匹配规则。 |
| `src/domain/onboarding/trainingProfile.types.ts` | 首次训练信息表单类型。 |
| `app/(tabs)/plan.tsx` | 计划页展示当前计划仪表盘、本周安排、我的计划管理、计划库入口和收纳式计划操作弹层。 |
| `app/onboarding/training-profile.tsx` | 首次训练信息完善和推荐计划选择流程。 |
| `src/components/plan/PlanEditOverview.tsx` | 用户计划编辑器，支持周视图、复制下一周、训练日长按拖拽排序和动作长按拖拽排序、周几选择、返回退出未保存提示。 |
| `src/components/ui/MiniLineChart.tsx` | 轻量折线图（仍用于其他页面，计划页已替换为 `MiniBarLineChart`）。 |
| `src/components/ui/MiniBarLineChart.tsx` | 计划页「最近执行」使用的柱状图+折线图组合组件：柱=训练量、折线=完成训练次数。 |
| `app/(tabs)/today.tsx` | 训练页当前计划卡和计划切换弹层。 |
| `app/plan/create.tsx` | 第一版创建计划页面，接入统一动作选择器。 |
| `src/tests/plan.test.ts` | 系统方案复制、PPL 和动作库 seed 测试。 |
| `src/tests/plan-repository.test.ts` | 用户计划删除边界测试。 |

## 3. 关键函数

### listSystemTrainingSchemes

文件：`src/domain/plan/systemSchemes.ts`  
职责：返回本地系统方案目录。目录只包含方案元数据和可用状态，不包含训练记录。

### createUserPlanCopyDraft

文件：`src/domain/plan/planCopy.ts`  
职责：把系统模板的 template、phases、days、plan exercises 复制成新的用户计划草稿，生成新的本地 ID，设置 `source: "system_copy"` 和 `originSchemeId`。

### PlanRepository.listUserPlans

文件：`src/data/local/repositories/planRepository.ts`  
职责：只返回 `source != "system"` 的用户计划，避免系统方案污染“我的计划”。

### PlanRepository.copySystemSchemeToUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：读取系统方案引用的模板计划，复制 phases、days、plan exercises，并写入 SQLite。该方法只生成用户计划，不自动修改训练记录。

### PlanRepository.importUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：将导入计划草稿写入 SQLite，写入 template、phases、days、plan exercises、exercises 和 alternatives，并保证导入结果为用户计划。  
边界：拒绝把 `source: "system"` 的模板作为导入用户计划；不导入训练记录、成员 1RM 或身体数据；不覆盖既有计划；动作按名称复用本机已有动作，缺失动作才写入。

### PlanRepository.deleteUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：删除用户计划的 template、phases、days 和 plan exercises。  
边界：系统方案不能删除；当前计划不能删除；最后一个用户计划不能删除；不删除 `workout_sessions`、`workout_exercise_records` 或 `workout_sets`。

### PlanRepository.updateUserPlan

文件：`src/data/local/repositories/planRepository.ts`
职责：编辑用户计划的名称、说明、周期、训练日和计划动作结构。
边界：系统方案不能编辑；更新只重建 plan template / phases / days / plan exercises，不删除或改写既有训练记录。

### 训练页计划切换

文件：`app/(tabs)/today.tsx`  
职责：顶部当前计划卡提供“切换计划”按钮，弹层只列出 `listUserPlans()` 返回的用户计划。用户选择后更新当前 group 的 `activePlanId`、`currentWeek`、`currentPhaseType`，并刷新今日训练内容。  
边界：不直接列出或执行系统方案；历史记录继续打开训练时快照。

### PlanRepository.createUserPlan

文件：`src/data/local/repositories/planRepository.ts`  
职责：从创建计划页面生成用户拥有的 `blank_created` 计划，包含基础周期、多个训练日和计划动作。第一版不做完整拖拽编辑器。

### GroupRepository.updateGroup

文件：`src/data/local/repositories/groupRepository.ts`  
职责：计划页把复制出的用户计划设为当前计划时，更新 `groups.active_plan_id`、`current_week` 和 `current_phase_type`。

## 4. 数据结构映射

当前未新增独立 `system_training_schemes` 表。第一版采用：

- `SystemTrainingScheme`：domain 层只读 catalog。
- `UserTrainingPlan`：复用 `plan_templates`，通过 `source != "system"` 判断。
- `originSchemeId`：落在 `plan_templates.origin_scheme_id`。
- `ActivePlan`：复用 `groups.active_plan_id`、`current_week`、`current_phase_type`。

## 5. 文件导入导出

第一版推荐导出 `.liftmark.json`，并预留 `.json`、`.liftmark`、`.liftmark.zip`。导出对象是用户计划，不是系统方案。当前 service 仍输出开放 JSON schema：

```text
format: liftmark-plan
schemaVersion: 1
app: LiftMark
```

## 6. 测试

已覆盖：

- 系统方案目录不展示 legacy 四练方案。
- 系统“Push Pull Legs 三分化计划”存在且引用系统模板 ID。
- 系统“经典四分化增肌计划”存在且引用系统模板 ID，复制后保留四个训练日和 24 个计划动作。
- 主流推荐规则能按新手、增肌 4 天、力量、减脂和居家器械条件命中对应方案。
- 复制系统方案时生成新的用户计划 ID。
- 复制结果 `source` 为 `system_copy`。
- 复制结果记录 `originSchemeId`。
- phases、days、plan exercises 指向新的用户计划结构。
- 导入计划草稿生成 `source: "imported"`、`visibility: "private"`，且不会保留系统方案来源。
- 用户计划删除不会碰训练记录表。
- 用户计划编辑不会碰训练记录表，且系统方案编辑会被拒绝。
- 系统动作库包含 100+ 个无重名系统动作，覆盖 PPL 和补录常用动作。

## 7. 文档同步记录

- 2026-06-12：系统方案与用户计划分离；计划页新增“系统方案”和“我的计划”；新增 `origin_scheme_id` migration；默认小组当前计划切换到默认用户计划副本。
- 2026-06-12：同步可用性 + UI 落地 Sprint：计划页当前计划改为大图卡风格；创建计划入口接入 `app/plan/create.tsx` 和 `PlanRepository.createUserPlan()`；未完成深层编辑显示统一开发中提示。
- 2026-06-12：同步本地图片资产落地：计划页和创建计划页 Hero 通过 `liftmarkImages.planHero` 使用本地训练计划图片；计划模板、seed、SQLite schema 和 Repository 未变。
- 2026-06-14：新增“经典三分化 PPL”系统模板、导入计划落库、设置/计划页导入入口和训练页用户计划切换弹层。
- 2026-06-15：计划页重做为当前计划仪表盘；新增用户计划删除边界；创建计划接入统一动作选择器；导入计划按动作名称复用本机动作。
- 2026-06-29：计划页本周执行趋势改为折线图；创建、导入、导出和管理全部计划收进计划操作底部弹层，页面不再展示大块计划工具网格。
- 2026-06-30：系统方案目录切换为主流计划库；新增经典四分化增肌计划；计划页系统方案移入计划库弹层；新增训练信息完善与推荐计划流程；默认当前计划改为新手全身训练计划；旧四练仅作为 legacy 数据兼容保留。
- 2026-07-01：计划首页瘦身；计划详情改为右上角操作菜单；创建计划支持多训练日；新增用户计划编辑和 `PlanRepository.updateUserPlan()`。
- 2026-07-01：计划首页新增显式切换/编辑入口；执行趋势 X 轴改为周起始日期并支持短数据靠左展示。
- 2026-07-02：训练总结页可将本次替换、加做、跳过和临时动作投射回当前用户计划；系统方案仍由 `updateUserPlan()` 拒绝直接编辑，训练执行页本身不写计划表。
- 2026-07-07：计划页接入当前小组；编辑器改为周视图，复制到下一周和顺序调整落地，概览和动作行改为紧凑布局。
- 2026-07-07（二）：编辑计划页面与仪表盘重设计。`PlanEditOverview.tsx` 改为紧凑单行概览 + 周几选择 + 训练日/动作长按拖拽排序（替代「调整顺序」按钮）+ 复制/添加图标 + 嵌套滚动；`app/plan/edit/[planId].tsx` 加返回退出未保存提示；计划页「本周执行」改「最近执行」并用新建 `MiniBarLineChart` 同时显示训练量与完成训练次数；StatTile 缩小；去除「上一周 / 下一周」按钮；`VisualHeroCard` 新增 `actionIcon` / `onActionPress` props，计划页改用顶部右上角图标弹出管理计划弹窗。
