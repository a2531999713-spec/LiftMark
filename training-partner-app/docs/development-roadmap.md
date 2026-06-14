# 开发路径图

## 2026-06-14 设置 / 历史 / 计划切换清理 Sprint

- 已完成：设置页使用 LiftMark 品牌专属图；成员资料改为全成员摘要入口；加重单位改为全成员选择入口；移除周五策略入口和最近导出 JSON 预览。
- 已完成：计划页和设置页导入 `.liftmark.json`，通过 DocumentPicker、计划文件 schema 校验、ID 重映射和 SQLite 落库生成“我的计划”。
- 已完成：新增系统只读模板“经典三分化 PPL”，可通过“使用此方案”复制成用户计划。
- 已完成：训练页当前计划卡新增“切换计划”，只列出用户计划，切换后刷新今日训练。
- 已完成：记录页最近训练改为训练摘要卡并点击进入详情。
- 已完成：`.gitignore` 补齐 node_modules、Expo 缓存、Android build 产物、APK/AAB/keystore 和环境变量忽略规则。
- 后续：文件保存/分享/复制、计划深层编辑器、真实小组汇总、云同步和远程方案库仍延后。

## 2026-06-14 训练执行交互修正 + UI 重设计补充

- 已完成：训练执行页 RPE/RIR 从数值输入改为纯 preset 点选，不再弹出键盘。
- 已完成：记录页按 `docs/ui/record-page-redesign.png` 改为紧凑数据页，强化当前成员个人口径、基础趋势、可点击日历和记录列表。
- 已完成：设置页按 `docs/ui/settings-page-redesign.png` 改为移动设置中心，保留导出、计划管理、激活、诊断和危险操作入口。
- 已完成：搭子页将完整本地小组规则收纳到二级弹层，主页面仅显示短说明。
- 已完成：图标背景与 safe margin 修复，Expo splash 引用透明居中 `splash-logo.png`。
- 后续：真实小组汇总、显式成员切换、设置页文件保存/分享、复杂训练趋势和更完整页面视觉回归。

## 2026-06-14 训练执行体验与记录数据口径修复

- 已完成：训练执行页完成本组后自动进入休息、下一组、下一个动作或训练总结。
- 已完成：重量/次数直接输入，RPE/RIR 可留空并按范围校验。
- 已完成：当前动作已完成组可编辑、删除，并支持撤销上一组。
- 已完成：补录训练支持休息时间留空，并写入训练动作记录快照。
- 已完成：记录页默认只统计当前成员个人数据，并明确展示当前成员、我的本周训练量、我的本周训练次数、我的本周完成组数。
- 已完成：小组汇总入口改为开发中说明，不混用个人统计。
- 已完成：搭子页和设置页补充本地小组与未来云同步规则。
- 后续：显式成员切换、小组汇总真实聚合、训练密度、复杂疲劳分析和高级图表。
## 2026-06-14 品牌迁移完成项

- 品牌迁移 Sprint：完成“练刻 LiftMark”命名、图标资源、启动页、Android package、导出格式、设置页品牌卡和关于页。
- 当前推荐验收命令仍为 `npm run android:preview`，打开包名 `com.liftmark.app`。
- 后续 Sprint 继续从训练功能出发，不在本 Sprint 增加云同步、登录、计划市场或业务重构。


更新时间：2026-06-12

## 1. 已完成功能

| 功能 | 状态 | 相关模块 | 相关文档 | 完成时间 |
|---|---|---|---|---|
| 项目 docs 文档体系 | 已完成 | docs | `docs/` | 2026-06-08 |
| Sprint 1 项目骨架和数据库骨架 | 骨架已完成 | database, group, member, plan, workout, progression | `training-partner-app/`, `docs/database/schema.md`, `docs/api/local-repository-api.md` | 2026-06-09 |
| Sprint 2 成员管理 | 实现已完成 | member, group, weight | `app/(tabs)/members.tsx`, `app/member/*`, `src/components/members/`, `src/tests/member.test.ts` | 2026-06-09 |
| Sprint 3 默认计划和今日训练 | 实现已完成 | plan, exercise, weight, recovery | `src/data/seed/defaultExercises.ts`, `src/data/seed/defaultAlternatives.ts`, `src/data/seed/defaultStrengthPlan.ts`, `src/data/seed/defaultHypertrophyPlan.ts`, `src/data/seed/defaultDeloadPlan.ts`, `app/(tabs)/today.tsx`, `app/(tabs)/plan.tsx`, `src/tests/plan.test.ts`, `src/tests/weight.test.ts`, `src/tests/recovery.test.ts` | 2026-06-09 |
| Sprint 4 训练执行页 | 实现已完成 | workout, member, plan, exercise, weight | `app/workout/[sessionId].tsx`, `app/workout/summary/[sessionId].tsx`, `src/data/local/repositories/workoutRepository.ts`, `src/tests/workout.test.ts` | 2026-06-09 |
| 稳定性与基础体验 Sprint | 基础完成 | settings, export, plan, history, Android build | `app/(tabs)/settings.tsx`, `app/(tabs)/history.tsx`, `src/services/planFileService.ts`, `src/services/exportService.ts`, `src/domain/history/history-analysis.ts`, `package.json` | 2026-06-11 |
| UI 设计系统与核心页面重构 Sprint | 基础完成 | ui, plan, group, member, workout, history | `src/theme/*`, `src/components/ui/*`, `app/(tabs)/explore.tsx`, `app/(tabs)/members.tsx`, `app/(tabs)/today.tsx`, `app/(tabs)/plan.tsx`, `app/(tabs)/history.tsx`, `app/workout/*` | 2026-06-12 |
| 计划模块系统方案分离 Sprint | 基础完成 | plan, group, database, export | `src/domain/plan/systemSchemes.ts`, `src/domain/plan/planCopy.ts`, `src/data/local/migrations.ts`, `src/data/local/repositories/planRepository.ts`, `app/(tabs)/plan.tsx` | 2026-06-12 |

## 2. 开发中功能

| 功能 | 当前状态 | 阻塞点 | 下一步 |
|---|---|---|---|
| 业务 App | 计划模块系统方案分离 Sprint 验证中 | 完整业务持久化场景仍需手工烟测 | 进入 Sprint 5 动作替换和训练完成增强，并保留 APK 安装后的业务回归检查 |
| Android 本地预览 APK | 已完成 | `npm run android:preview` 可编译、安装并打开 `com.liftmark.app` | 以 `npm run android:preview` 作为当前主要验收方式；清理优先用 `npm run android:clean:native`，development build 仅作为后续调试选项 |
| 可用性 + UI 落地 Sprint | 基础完成，本地图片资产已接入 | 需要 Android 设备继续做完整人工路径烟测 | 回归训练页周五覆盖、记录日历、补录、历史编辑、创建计划、激活码、设置页和图片 Hero 显示 |

## 3. 待开发功能

| 功能 | 优先级 | 预计模块 | 备注 |
|---|---|---|---|
| Sprint 5：动作替换和训练完成 | P0 | exercise, workout | 替换弹层、替换保存、总结 |
| Sprint 6：进阶建议和历史增强 | P1 | progression, history | progression engine、历史详情、动作筛选和更完整趋势 |
| Sprint 7：设置和导出增强 | P1 | settings, export | 文件保存/分享、计划导入落库、备份恢复 |
| Sprint 8：计划创建与编辑器基础 | P1 | plan, exercise, export | 创建计划向导、训练日编辑、动作模板和 `.liftmark.json` 导入落库 |

## 4. 延后功能

| 功能 | 延后原因 | 恢复条件 |
|---|---|---|
| 账号登录 | MVP 本地优先 | 阶段 3 云同步 |
| 云同步 | 先保证离线训练闭环 | Repository 和本地数据稳定 |
| 二维码加入 | 依赖账号和云端小组 | 阶段 3 |
| 计划编辑器 | MVP 先做默认计划执行 | 默认计划执行闭环稳定 |
| 计划市场 | 商业版能力 | 有账号、分享、审核和支付 |
| 教练模式 | 依赖云端小组和权限 | 阶段 5 |
| 动作视频 | 非 MVP 核心 | 动作库稳定并有素材 |
| 复杂数据分析 | MVP 后 | 历史数据足够 |

## 5. 技术债

| 技术债 | 影响 | 优先级 | 建议处理 |
|---|---|---|---|
| SQLite migration 版本策略需持续执行 | 后续表结构变更风险 | P0 | 已采用 `schema_migrations`，后续只追加 migration |
| roundToIncrement 边界策略未确认 | 建议重量可能有争议 | P0 | 在 weight 测试中固定策略 |
| 完整 seed 数据需要后续维护策略 | Excel 模板变化后已有本地数据是否迁移需确认 | P1 | 后续新增 seed 版本和重置策略 |
| 删除/清空策略未确认 | 历史记录误删风险 | P1 | 设计软删除或确认二次确认策略 |
| Android build 环境约束 | Gradle/JDK toolchain 已固定到 `JAVA_HOME` JDK 17；本地预览 APK 使用 `com.liftmark.app` | P0 | 保持 Node.js 22.13.0+ 和 JDK 17；遇到项目内 native/CMake 缓存异常先运行 `npm run android:apk:clean` |
| Gradle clean 与 node_modules CMake 缓存 | 原生 `gradlew clean` 在构建后可能清理到 `node_modules/react-native-reanimated/android/.cxx` 并失败；当前约束是不修改 `node_modules` | P1 | 不把 raw `gradlew clean` 作为本阶段 APK 验收步骤；如需深度清理 `node_modules` 生成缓存，需单独确认策略 |
| Android 全架构 release 构建 | `x86_64` 预览 APK 已通过；全架构构建曾在 `react-native-reanimated` 的 `armeabi-v7a` CMake 阶段出现 dirty manifest | P1 | 当前模拟器验收优先用 `npm run android:apk`；真机预览用 `npm run android:apk:device`；正式发版前再处理全架构产物 |

## 6. 重构计划

当前已有 Sprint 1 项目骨架和本地数据层骨架，暂无需要重构的业务实现。后续应避免先堆 UI 再抽 Domain。

## 7. 风险事项

- 如果先做 UI，容易把计划写死在组件中。
- 如果先做单人逻辑，后续多人改造成本高。
- 如果训练记录不用 SQLite，即使 MVP 能跑也无法可靠用于训练现场。
- 如果不先定义 schema 和 Repository，后续云同步边界会混乱。

## 8. 版本计划

### Sprint 1：项目骨架和数据库

状态：骨架已完成，Android 本地预览 APK 流程已补齐；TypeScript、lint、项目内 native clean、x86_64 release APK 构建、APK 安装和首屏启动均已在 Node.js v24.16.0 / Microsoft JDK 17.0.19 下通过。原生 `gradlew clean` 在构建后仍可能受 `node_modules` CMake 生成缓存影响，本阶段不作为 APK 验收步骤。

任务：

- 创建 Expo 项目。
- 配置 Expo Router。
- 配置 TypeScript。
- 配置 ESLint / Prettier。
- 创建主题系统。
- 创建 SQLite 初始化。
- 创建 migrations。
- 创建基础 Repository。
- 创建 `seedDefaultData`。

验收：

- App 可在 Android 启动：已通过本地 release APK 在模拟器打开首屏；真机仍需人工验证。
- 首次启动自动创建默认数据：已创建 `initializeLocalDatabase` + `seedDefaultData` 入口。
- SQLite 表创建成功：已通过 schema/migrations 代码和类型检查，并通过 APK 首屏启动烟测验证初始化不崩溃。
- 可以读取默认 group 和默认 plan：已创建 SQLite Repository 骨架和默认 group/plan shell seed。

### Sprint 2：成员管理

状态：实现已完成，本地 APK 首屏已通过；成员新增/编辑后关闭重开 App 的持久化烟测待手工验证。

验收：

- 可以创建 2-4 个成员：已实现成员列表、新增成员和最多 4 人限制。
- 每个成员可以保存不同 1RM：已实现体重、四大项 1RM、引体参考重量、杠铃/哑铃加重单位表单。
- 关闭 App 后数据仍存在：已通过 SQLite Repository 写入；仍待 Android 真机关闭重开烟测。

### Sprint 3：默认计划和今日训练

状态：实现已完成，本地 APK 首屏已能读取默认计划并展示 Today；完整计划切换和成员建议重量烟测待手工验证。

验收：

- 今日训练页能显示正确训练内容：已从 SQLite seed 读取 `PlanDay` / `PlanExercise` / `Exercise`。
- 不同成员显示不同建议重量：已按成员 1RM、器械类型和加重单位计算。
- 状态一般隐藏 C 动作：已实现 recoveryMode `normal` 过滤。
- 状态差只显示 A 动作：已实现 recoveryMode `bad` 过滤。
- 周五默认休息：默认小组 `friday_enabled=0`，Plan 页可开启。

### Sprint 4：训练执行页

状态：实现已完成，本地 APK 已可启动到 Today；完整训练执行、退出重进和完成总结烟测待手工验证。

验收：

- 可以完成一场多人训练：已支持从今日训练创建 session、records、sets 并进入执行页。
- 中途退出后重新进入不丢数据：执行页从 SQLite 读取 session detail，同一天未完成 session 会复用。
- 每个成员的实际重量、次数、RPE/RIR 独立保存：每个成员每组对应独立 `workout_sets` 行，`saveSet` 即时保存。
- 默认按动作轮换：训练页按动作导航，当前动作下展示成员 set 卡。
- 训练执行页不是 Excel 表格：使用卡片和大按钮 stepper。

### Sprint 5：动作替换和训练完成

验收：

- 器械被占时可以替换动作。
- 历史记录保留 `replaced_from_exercise_id`。
- 完成训练后进入总结页。

### Sprint 6：进阶建议和历史

验收：

- 增力期可生成加重/维持/降重/减量建议。
- 增肌期可生成加重/继续加次数/维持或降重建议。
- 记录页可以查看最近训练。

### Sprint 7：设置和导出

验收：

- 用户可以导出本地训练数据：基础 JSON 字符串已实现，文件保存/分享待增强。
- 可以重置 seed 数据：已实现重置默认计划入口，且不删除训练记录。
- App 无数据时有合理空状态：设置和历史页已具备基础空状态。
- 可以导出当前计划为 `.liftmark`：service 和设置页入口已实现。
- 可以导入计划：service 已支持 schema 校验和新 ID 重映射，文件选择和落库待增强。

## 9. 下一步建议

下一步建议进入 Sprint 5：动作替换和训练完成增强。开发验收优先使用本地预览 APK：`npm run android:preview`。并行补五项设备验收：首次启动数据库 seed 烟测、成员新增/编辑后关闭重开 App 的持久化烟测、今日训练页读取当前用户计划烟测、训练执行页中途退出再进入烟测、五个主 Tab 在小屏和大屏模拟器上的视觉回归检查。
