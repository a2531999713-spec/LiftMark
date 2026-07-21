## 2026-07-21 v2.11.1 训练写入管线

- `WorkoutWriteCoordinator` 合并同一 set 的最新 patch，替换逐输入 Promise chain；失败 patch 恢复后可重试。
- `saveSetPatchesBatch` 与 `completeSessionAtomic` 一次 scope/目标读取，在单事务内写最终 set 和 session sync metadata。
- 输入链路不写 `local_sync_queue`；批量候选在边界事件或路由后按 owner/type/localId 去重。
- `reconcileDirtyWorkoutSyncQueue` 以业务表 `sync_status` 重建训练队列，保证异常退出后的可恢复性。
- 结束关键路径仅包含锁、freeze、必要 drain、原子完成和路由；报告/progression/achievement/network sync 后置隔离。
- lifecycle/unmount/background 规则避免重复 flush；进度 selector 只读取真实 set 状态。
- 现有 SQLite 索引足够，无移动端/服务端 migration、API 或部署变化。

## 2026-07-21 v2.11.0 成就连续性架构

- `domain/achievement` 提供稳定 catalog、Monday-week 纯函数、进度计算、12 周活动与单调 merge；页面不读取数据库字段。
- `SQLiteAchievementRepository.getAchievementSnapshot` 只接受当前认证 owner，使用固定聚合查询读取有效 session/set、周期与恢复记录，不读取空 owner 历史数据。
- 有效 session 必须 completed、未软删且至少含一组 completed/non-skipped/non-deleted set；容量只累计这些有效组。
- `useAchievementSnapshot` 先展示本地快照，再请求认证 API；远端失败保留本地，合并采用最大进度、achieved OR 和最早 `achievedAt`。
- 解锁检测在 summary 路由已经打开后后台执行，seen/pending key 包含 `userId`，不会跨账号串联或阻塞训练结束。
- 服务端固定读取 definitions、existing achievements 与聚合指标，在内存 Map 中 reconcile 后单事务批量 upsert，无 definition 数量相关 N+1。
- 无 SQLite/PostgreSQL migration；generic sync 不传输 `user_achievements`，服务端根据已同步业务事实重算。

## 2026-07-15 v2.10.0 恢复状态架构

- `domain/recovery/recovery-engine.ts` 只负责六项评分、阈值、硬覆盖和确定性 reasons；不返回颜色或 JSX。
- `recovery-workout.service.ts` 将 recommendation 映射到共享动作快照与重量调整，纯函数不写 plan。
- `SQLiteRecoveryRepository` 的所有查询从当前 owner 与可见 group/member scope 进入，同成员同日本地事务 upsert 后入队。
- Today 计划和恢复状态分两条加载链；恢复失败只影响状态卡，避免“首页暂时无法加载”。
- 恢复动作过滤只使用内存中的完整 `PlanExercise[]`；session 创建后才在单一事务中调整当前 session、所选成员、未完成且未跳过的 sets。
- pull 仅按 member id/local_member_id/remote_id 在当前可见小组内精确挂载，不按昵称推断。
- 现有 schema 与 generic sync contract 足够，无移动端/后端 migration 或 API 变更。

## 2026-07-15 v2.9.0 系统计划库与预览架构

- `features/plan-library/systemPlanLibrary.ts` 承载纯筛选、稳定排序和结构化目录校验。
- `systemSchemePreview.ts` 统一 `ready / metadata_only / unavailable` view model、周分组、处方格式和时长区间估算。
- `PlanRepository.listPlanExercisesForDays(dayIds)` 通过 scoped join 一次批量读取处方；系统详情不再逐训练日查询。
- `SystemSchemeDetailContent` 被独立详情路由与 onboarding 全屏覆盖层共享。
- `activateTrainingPlanForGroup()` 在结构兼容后调用 `ensureActivePlanCycle()`，保证新复制/导入/切换计划具有当前周期。
- 无 schema、API、共享 DTO 或服务端变更。

## 2026-07-11 P1 计划周期、报告与历史查询补充

- 新增 `domain/report/trainingReport.service.ts` 与 `domain/plan/planCycle.service.ts` 作为报告和周期统计的纯领域口径。
- 新增 scoped `TrainingReportRepository`、`HistoryRepository`，以及 `PlanRepository.getPlanCycleOverview/completePlanCycle/recalculatePlanCycleSummary`；页面只通过 controller/use case 访问。
- 历史列表以 owner + group 为入口执行一条 aggregate query，避免逐 session 查询 report/cycle/plan 的 N+1。
- 复用 SQLite v23 与现有 sync registry；没有 schema、API 或共享契约变更。详见仓库级 `docs/03-architecture/plan-cycle-report-history-implementation-2026-07.md`。

## 2026-07-11 核心架构收敛补充

- 根路由由 `AppScopeProvider` 统一提供当前账号、小组、成员、激活计划与周期上下文；账号切换只清理跨账号运行态和选择态，不删除 SQLite 业务数据。
- `app/(tabs)/today.tsx` 与 `app/workout/[sessionId].tsx` 已收敛为薄路由，具体界面位于 `src/features/home/` 与 `src/features/workout-session/`。新增 application use case、reducer/selector、controller 与服务边界，旧 UI 交互保持不变。
- 首页周汇总和最近表现改为账号/小组作用域内的 SQLite 聚合查询，移除首页逐 session 加载详情的 N+1 路径。
- 训练组保存经串行自动保存服务写入本地 SQLite；结束训练前会 flush 防抖和在途写入。休息计时由时间戳推导，不依赖累计 tick。
- 移动端同步实体、显式字段和删除策略集中在 `src/sync/registry/`；设备标识为 SecureStore 保存的安装级随机 ID，不使用硬件标识。
- 三端稳定契约位于仓库 `packages/shared/`；只共享同步 DTO、实体名、状态与错误码，不共享数据库实现或 UI 模型。
- 管理控制台目录为 `management-console/`，服务端 API 仍为 `apps/liftmark-api/`。

## 2026-07-06 双向数据同步与归属不可变架构补充

- 同步模型从单向 push 升级为双向 pull + push；新增 `src/sync/pullService.ts` 和 `src/sync/syncOrchestrator.ts`。
- App 启动、从后台回前台、登录、训练完成和数据修改后自动触发同步，不再依赖手动按钮。
- `owner_user_id` 在 `upsertFromServer` 的 UPDATE 语句中被排除，创建后不可变。
- 新增 `sync_state` 表（migration 17）记录同步游标 `last_pull_at`，支持增量 pull。
- 同步架构详见 `docs/sync-architecture.md`；数据库架构问题分析与重新设计见 `docs/database/schema-redesign.md`。

﻿## 2026-06-30 图表、身体数据、多小组和训练替换架构补充

- 图表组件仍为本地 UI 组件，不引入大体积图表库；`MiniLineChart` / `MultiLineTrendChart` 在组件内完成坐标缩放、绘图区 padding、刻度、单位和空状态。
- `body_metrics` 与 `body_metric_goals` 通过 SQLite + Repository 持久化；身体数据不进入 AsyncStorage。
- 当前小组使用 `src/store/selectedGroupStore.ts` 作为轻量 UI 状态；训练记录归属仍以 `workout_sessions.group_id` 为准。
- `GroupRepository.listGroups()` 是多小组视图解析入口；页面不得用默认小组硬编码替代。
- 头像链路分为账号缓存 `account_profile_cache` 和成员 profile `member_profiles`；训练相关页面统一读取成员头像。
- 训练中替换动作只更新 `workout_exercise_records.exercise_id`，并保留 `replaced_from_exercise_id`；计划表不被修改。
- RPE 和实际休息秒数走 `WorkoutRepository.saveSet()`，RIR 仅保留旧字段兼容，不作为新 UI 能力。

## 2026-07-03 小组真实成员与头像同步架构补充

- 云端 `group_members.user_id` 是真实成员唯一账号绑定；移动端 `group_members.member_type` 区分 `real` 和 `local`。
- 邀请码加入后移动端通过 `/sync/groups-pull` 拉取小组和成员，写入本地 SQLite 缓存。
- 账号头像上传、删除和 `/sync/avatar` 同步 `users.avatar_url` 与该用户的 `member_profiles.avatar_url`；移动端统一用 `src/utils/avatarUrl.ts` 解析相对头像路径。
- 待确认训练数据接受后，云端写入通用 workout 同步表，移动端立即写入本地 SQLite 历史，保持弱网缓存模型不变。

## 2026-06-30 本地计划推荐与训练选择补充

- 本次未新增 SQLite schema 或 migration；主流系统计划通过 seed 数据写入现有 `plan_templates`、`plan_phases`、`plan_days` 和 `plan_exercises`。
- 主流系统方案新增“经典四分化增肌计划”；旧 Excel 四练兼容模板继续隐藏在 legacy seed / migration 中，不作为新推荐入口。
- 旧四练 seed 和 migration 继续存在用于历史兼容；当前系统方案目录和用户计划列表在 domain/repository 层隐藏 legacy 入口。
- Onboarding 推荐逻辑位于 `src/domain/plan/planRecommendation.ts`，页面只收集资料和调用 repository 复制方案。
- 计划页主界面不直接展开系统方案列表，系统方案通过计划库弹层预览和复制。
- 今日训练页的临时周次 / 训练日选择不写入 `groups.current_week`，创建 session 时通过 `WorkoutRepository.createSessionFromTodayPlan()` 的输入快照写入 `workout_sessions`。
- 今日训练页“动作筛选”会把筛选后的 `planExerciseIds` 传入创建 session，训练记录保存本次动作快照。
- 训练执行页标题读取当前 session 的 title/week/weekday，不允许硬编码固定周次和训练日。
- 历史详情默认只读；编辑和删除通过更多菜单进入，不改变原计划模板。
- 小组动作详情页从本机 SQLite session 明细聚合，不依赖远程服务，并支持指标、时间范围和成员筛选。
- 普通二级页可通过 `Screen safeTop={false}` 关闭页面内顶部安全区，避免 Stack 返回和内容标题重复留白。

## 2026-06-24 云服务第一版架构补充

- 新增后端工程：`apps/liftmark-api`。
- 后端栈：Node.js、TypeScript、Fastify、PostgreSQL、Knex migration、JWT、PM2、Nginx。
- 公网访问边界：Node 只监听 `127.0.0.1:3000`，公网通过 Nginx `/api` 反向代理。
- App API 地址通过 `EXPO_PUBLIC_API_BASE_URL` 配置，默认开发地址为 `http://47.100.239.29/api`。
- 客户端统一 API 配置位于 `src/config/api.ts`。
- API smoke 脚本位于 `scripts/api-smoke-test.js`，通过 `npm run test:api-smoke` 执行。
- Android Studio debug 运行需要 Expo Dev Client + Metro + 深链打开，步骤见 `docs/android-studio-run.md`。
- App token 使用 `expo-secure-store` 保存；App 不保存阿里云 AccessKey，也不直接调用阿里云短信接口。
- 2026-06-30 起，本地 SQLite schema 增加同步元数据和 `local_sync_queue`，训练 session / set 保存后进入待同步队列。
- 云同步第一版服务端表已创建；App 端 `src/sync/syncQueue.ts` 和 `src/sync/syncService.ts` 负责本地队列、状态统计和 `/sync/push` 推送。训练记录仍先写本机缓存，不能因云端失败丢失现场数据。

# 技术架构文档
## 2026-06-14 品牌与 Android 包名迁移

- Expo `app.json`：`name` 为“练刻”，`slug` / `scheme` 为 `liftmark`。
- Android `namespace` / `applicationId`：`com.liftmark.app`。
- Android Kotlin 源码包路径：`android/app/src/main/java/com/liftmark/app/`。
- `package.json` 一键预览脚本打开 `com.liftmark.app`。
- 品牌图标、adaptive icon、splash、favicon 位于 `training-partner-app/assets/brand/`；Android 原生 res 已同步，`npm run android:apk` 不依赖重新 prebuild。


更新时间：2026-06-11

## 1. 架构概览

目标架构是 React Native + Expo + TypeScript 的云端优先 + 本地缓存移动 App。云端 PostgreSQL 是主数据源；移动端写入先落本机 SQLite 缓存并进入 `local_sync_queue`，弱网训练不被阻断，网络可用后通过同步服务推送到后端。Domain 层承载训练计划、重量计算、进阶建议、恢复评分等核心逻辑，UI 只负责展示和输入。

```text
UI / App Routes
  -> Components
  -> Store
  -> Domain Services
  -> Repository Interfaces
  -> SQLite local repositories
  -> local_sync_queue
  -> Sync Service
  -> Fastify API / PostgreSQL
```

## 2. 前端架构

- Framework：React Native。
- Runtime / Tooling：Expo。
- Navigation：Expo Router。
- State：Zustand。
- Forms：React Hook Form + Zod。
- List：FlashList。
- Animation / Gesture：React Native Reanimated、React Native Gesture Handler。
- Date：date-fns。
- Icons：`@expo/vector-icons`，当前底部 Tab 使用 Ionicons，避免 Android release APK 中默认图标字体显示为缺字方框。
- Testing：Jest + jest-expo + React Native Testing Library。

## 2.1 第一阶段运行和调试目标

推荐运行方式：

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm install
npm run android:preview
```

`npm run android:preview` 会执行 `android:apk`、`android:install` 和 `android:open`，完成“编译 APK -> 安装 APK -> 打开 App”。`npm run android:apk` 默认构建本机模拟器预览用的 `x86_64` release APK，并在 release 构建中通过 `createBundleReleaseJsAndAssets` 将 `index.android.bundle` 和 assets 打进 APK。真机预览可使用 `npm run android:apk:device` 构建 `arm64-v8a` 包；如需全架构包可使用 `npm run android:apk:universal`，但全架构 native 编译更慢，且更容易暴露 NDK/CMake 缓存问题。

development build 仍作为后续可选调试方式保留：

```powershell
npm run android:build
npm run start:dev-client
```

development build 需要 Metro；本地预览 APK 不需要 Metro。当前阶段不依赖 Expo Go 自动下载。`expo-sqlite` 保留为 Android / iOS / Web 的本地数据库方案。

本地 Android build 推荐环境：

- Node.js 22.13.0 或更高版本；当前已验证 Node.js v24.16.0 / npm 11.13.0 满足要求。
- 64-bit JDK 17；当前推荐 `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`，不要切到 Java 24。
- Android SDK Platform 36、Build Tools 36、NDK 27.1。
- Gradle 通过 `JAVA_HOME` 发现 JDK 17，并关闭 toolchain 自动下载，避免 React Native Gradle Plugin 的 Foojay resolver 在 Gradle 9.3.1 下触发 `JvmVendorSpec.IBM_SEMERU` 兼容错误。
- 当前本地预览 APK 在 `C:\Users\zhw\Documents\LiftMark\training-partner-app` 下执行 `x86_64` release 构建和模拟器首屏烟测。若后续 native module 再出现 CMake / Ninja 缓存异常，先执行 `npm run android:apk:clean` 清理 `android/app/.cxx`、`android/app/build`、`android/build` 等项目内生成目录后重建。原生 `gradlew clean` 在一次 native 构建后可能继续尝试清理 `node_modules/react-native-reanimated/android/.cxx` 等生成缓存；在“不修改 node_modules”的约束下，不把 raw `gradlew clean` 作为本阶段 APK 验收步骤。
- Android package / applicationId：`com.liftmark.app`。

## 3. 后端架构

当前后端位于仓库根目录 `apps/liftmark-api`，使用 Node.js 22+、TypeScript、Fastify、PostgreSQL、Knex migration、JWT 和短信验证码登录。公网通过 Nginx `/api` 反向代理到本机 `127.0.0.1:3000`。

已存在能力：

- 账号系统、短信验证码登录 / 注册、JWT 鉴权。
- PostgreSQL migration：用户、小组、成员关系、训练同步实体表、`sync_mappings`、`sync_state`。
- 同步接口：`POST /api/sync/push`、`GET /api/sync/pull?since=...`、`GET /api/sync/status`。
- 训练上传/查询接口：`POST /api/groups/:id/workouts/upload`、`GET /api/groups/:id/workouts` 和统计接口。

移动端不直接把训练现场写入远端作为唯一成功条件；本地 SQLite 写入成功后进入同步队列，云端失败时保留待重试状态。

## 4. 数据库架构

使用 Expo SQLite 保存训练数据。训练数据禁止使用 AsyncStorage。

主要数据组：

- 小组和成员：`groups`、`group_members`、`member_profiles`。
- 动作与替代：`exercises`、`exercise_alternatives`。
- 计划模板：`plan_templates`、`plan_phases`、`plan_days`、`plan_exercises`。
- 实际训练：`workout_sessions`、`workout_exercise_records`、`workout_sets`。
- 建议与恢复：`progression_suggestions`、`recovery_logs`。

详见 `docs/database/schema.md`。

Sprint 1 实现位置：

- `training-partner-app/src/data/local/db.ts`
- `training-partner-app/src/data/local/schema.ts`
- `training-partner-app/src/data/local/migrations.ts`
- `training-partner-app/src/data/local/repositories/`

`initializeLocalDatabase()` 在运行时执行 migrations 和 `seedDefaultData()`，并使用可复用初始化 Promise，避免首屏 layout 和页面数据读取同时触发重复初始化。

Android Gradle 配置要点：

- `android/gradle.properties` 固定从 `JAVA_HOME` 发现 JDK：`org.gradle.java.installations.fromEnv=JAVA_HOME`。
- `org.gradle.java.installations.auto-download=false`，不让 Gradle 自动下载 toolchain。
- Gradle daemon 使用 `-Xmx2048m -XX:MaxMetaspaceSize=1024m`，降低 release APK 构建过程中 metaspace 耗尽导致 daemon 退出的概率。
- 不设置 vendor 限制，不使用 `JvmVendorSpec.IBM_SEMERU`。
- `android/app/build.gradle` 的 release 构建仅为本地预览 APK 使用 debug keystore 签名，不能用于 Play Store 或正式发布。
- `android:apk` 构建路径为 `android/app/build/outputs/apk/release/app-release.apk`，已验证包内存在 `android/app/build/generated/assets/react/release/index.android.bundle`。
- `android:open` 使用 `adb shell monkey -p com.liftmark.app -c android.intent.category.LAUNCHER 1`。

## 5. 缓存设计

第一阶段没有服务端缓存。AsyncStorage 只可用于：

- 轻量设置。
- 首次启动标记。
- 最近选中的 `group_id`。
- 主题偏好。

## 6. 队列设计

第一阶段不实现云同步队列，但目录预留：

- `src/sync/syncQueue.ts`
- `src/sync/syncTypes.ts`
- `src/sync/conflictResolver.ts`

后续同步字段建议包括 `remote_id`、`sync_status`、`deleted_at`。

Sprint 1 已创建上述 sync 目录骨架，但不执行远程同步。

## 7. 鉴权与权限

当前已接入 LiftMark 后端账号服务。App 启动先读取 SecureStore session：

- 无 session：进入 `/account/login`，必须通过手机号密码登录或手机号验证码注册。
- 有 session 且在线：轻量校验 `/auth/me`，再进入主 Tab。
- 有 session 但服务器不可达：进入 `offline_authenticated` 本机模式，不拉取云端完整数据。

账号 token 使用 `expo-secure-store` 保存。训练记录仍先写本地 SQLite，登录、刷新 token、会员状态或云同步失败都不得阻塞训练现场保存。

## 8. 文件存储

当前 UI 使用随 APK 打包的本地图片资产，位于 `src/assets/images/`，用于探索、搭子、训练、计划、记录、设置、激活和训练总结等 Hero 场景；这些资产不进入 SQLite，也不参与计划 seed。账号头像支持本地选择、裁剪、压缩和缓存：SQLite 只保存 URL、缩略图 URL、本地缓存路径和更新时间，不保存图片二进制或 Base64。后续动作视频、头像云存储和导出备份可接对象存储。

计划文件第一版推荐 `.liftmark.json`，内容为开放 JSON schema，并预留 `.json`、`.liftmark`、`.liftmark.zip`。`src/services/planFileService.ts` 负责生成、校验和导入 ID 重映射；计划文件只导出用户计划相关的 PlanTemplate、PlanPhase、PlanDay、PlanExercise、Exercise、ExerciseAlternative 和 ProgressionRule，不导出系统方案、训练记录或成员 1RM。

## 9. 第三方服务

- 当前后端：`http://47.100.239.29/api`，由 `src/config/api.ts` 配置，业务请求通过 `src/services/httpClient.ts`。
- 当前短信：App 只调用自有后端 `/auth/send-code`，不直接调用阿里云。
- 训练现场：无必须联网服务。
- 远期：正式域名 + HTTPS、支付、Apple Health、Garmin、Fitbit、小米/华为运动健康等健康数据源。

## 10. 配置管理

建议集中管理：

- `src/theme/colors.ts`
- `src/theme/spacing.ts`
- `src/theme/typography.ts`
- `src/theme/shadows.ts`
- `app.json`
- `tsconfig.json`
- Expo 环境配置

颜色不要散落在组件中。

`tsconfig.json` 中 `@/assets/*` 优先解析 `src/assets/*`，再回退到根目录 `assets/*`，用于区分业务 UI 图片和 Expo 图标/splash 资源。

Sprint 1 已创建 `src/theme/colors.ts`、`spacing.ts`、`typography.ts`、`shadows.ts`，页面骨架只使用基础占位组件，不做 UI 细节。

## 11. 日志与监控

第一阶段需至少保留本地错误处理和空状态。远期再接崩溃监控和远程日志。

## 12. 错误处理策略

- SQLite 写入失败必须提示并避免静默丢数据。
- seed 初始化失败要可重试。
- 训练中断后应能从 SQLite 恢复。
- Repository 不应吞掉错误。

## 13. 安全策略

- 本地训练数据包含体重、训练表现等隐私信息，导出前需提示用户。
- 计划导出必须二次确认。
- 后续云同步需处理账号、权限、删除和冲突。

## 14. 性能设计

- 训练执行页优先低延迟。
- 每次修改立即保存 SQLite，但 UI 需要避免阻塞输入。
- 历史列表使用 FlashList。
- 重量和今日训练计算应为纯函数，便于缓存和测试。
- 历史趋势和 PR 推算位于 `src/domain/history/history-analysis.ts`，使用 Epley 公式和最近 5 次训练数据输出中文建议；该建议不能表述为医疗或伤病结论。

## 15. 可扩展性设计

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 系统方案和用户计划分离；训练记录不能直接绑定系统方案。
- 多人逻辑从第一版就保留。
- 云端优先，本地 SQLite 作为缓存与离线副本。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。
- Excel 训练计划只整理为后续 seed 数据设计说明，不硬编码进页面组件。

Excel 训练计划的 seed 设计映射：

| Excel Sheet | 目标 seed/模块 | 说明 |
|---|---|---|
| 参数输入 | `member_profiles`、group 当前状态 | 1RM、加重单位、当前周期、周数、周五设置 |
| 增力周期总览 | `defaultStrengthPlan.ts` | 周推进、完成情况、百分比和减量 |
| 增力_每日计划 | `plan_days`、`plan_exercises` | 增力日动作框架和 A/B/C |
| 增力_按周展开 | `plan_days`、`plan_exercises` | 不同周主项组次和百分比 |
| 增肌周期总览 | `defaultHypertrophyPlan.ts` | 增肌目标、动作质量、双进阶 |
| 增肌_每日计划 | `plan_days`、`plan_exercises` | 胸/背/肩/腿动作 |
| 增肌_按周展开 | `plan_phases` 和周策略字段 | 每周容量、动作质量、A/B/C 取舍 |
| 周五补弱菜单 | seed 补弱训练日/动作组 | 根据补弱重点选择 |
| 动作替换库 | `defaultAlternatives.ts` | 替代动作关系 |
| 旧强度字段说明 | glossary / 帮助文案 | 强度解释 |
| 训练记录 | `workout_*` 表 | 不能直接复刻 Excel 表格 UI |
| 自动加重建议 | `progression-engine.ts` | 规则转领域函数 |
| 恢复评分 | `recovery-engine.ts` | 评分转建议 |

## 16. 架构风险

- Repository 层如果直接绑定 UI，会阻碍后续云同步。
- 计划如果硬编码在组件中，会阻碍计划编辑器和计划分享。
- 训练执行页若不即时保存，会导致真实训练现场丢数据。
- 训练历史如果不保存计划快照，会被未来计划修改破坏。

## 17. 需要人工确认的问题

- SQLite migration 版本管理方案已初步落地为 `schema_migrations` 表和顺序 migrations 数组；后续表结构变更按版本追加 migration。
- 是否在第一版就增加 `remote_id`、`sync_status`、`deleted_at` 字段。
- 本地导出的 JSON schema 版本号。
- 错误日志是否仅本地记录还是接入远程监控。

## 18. 可用性 + UI 落地 Sprint 架构变更

更新时间：2026-06-12

- 新增 migration v3 `friday_strategy_and_activation_state`。
- `groups` 增加 `friday_strategy`，当前可选值为 `default_rest`、`allow_weak`、`allow_free`；`friday_enabled` 继续保留作为兼容字段。
- 新增 `activation_state` 表，保存本地试用和激活状态。
- 新增 `src/domain/activation/` 和 `src/data/local/activation/`，保持激活逻辑不依赖 UI，并预留远程激活 provider。
- `WorkoutRepository` 增加历史补录和历史编辑接口，仍写入 `workout_sessions`、`workout_exercise_records`、`workout_sets`。
- `PlanRepository` 增加 `createUserPlan()`，创建用户拥有的 `blank_created` 计划；训练计划仍作为数据保存到 SQLite，不写死在页面组件中。
- 新增 `src/components/ui/VisualHeroCard.tsx` 和 `src/assets/images|icons|illustrations/` 目录；`VisualHeroCard` 支持本地图片背景和深色遮罩，页面通过 `src/assets/images/index.ts` 的 `liftmarkImages` 语义 key 引用图片。
## 2026-07-01 registration metadata, chart scale, and avatar migration

- `MiniLineChart` / `MultiLineTrendChart` share `src/components/ui/chartScale.ts`, so single-line and multi-line charts use the same real Y-axis strategy.
- SQLite migration v11 adds `group_members.avatar_url` for old local databases; new installs already have the column in initial schema.
- API migration `002_user_registration_metadata` adds server-side registration sequence and campaign fields to `users`.
- Account creation and SMS-code auto-registration use server time and PostgreSQL sequence values, not client time, for early-user eligibility.

## 2026-07-02 workout execution cursor, temporary edits, and startup

- Workout execution cursor is derived from domain helpers in `src/domain/workout/workout.service.ts`; UI rest state is not a source of truth for the next set.
- Temporary execution edits are persisted in the workout snapshot tables, not in plan templates: replacement uses `replaced_from_exercise_id`, extra sets and temporary exercises use notes markers, and skipped exercises mark current session sets.
- Summary can optionally project those session-level adjustments back into a user plan through `PlanRepository.updateUserPlan()`. System plans remain read-only.
- `app/_layout.tsx` no longer blocks initial route rendering on full local seed completion. The seed path writes a bootstrap version marker so repeated launches skip full default data work.
- `authService.getCurrentSession()` races remote `/auth/me` validation with a short stored-session fallback, preserving offline entry when the API is slow or temporarily unreachable.

## 2026-07-03 member identity and avatar sync

- SQLite migration v12 adds `group_members.user_id`, `member_type`, `local_member_id`, and `joined_at`.
- API migration `006_member_profile_avatar_fields` adds cloud member profile avatar fields for account-avatar propagation.
- `/groups/:id/members` and `/sync/groups-pull` return member avatars with member profile avatar preferred over account avatar.
- Pending-training accept writes cloud sync tables and returns session/sets for immediate local SQLite history insertion.
# 训练提醒（v2.6.0）

`trainingReminderRepository` 管理账号/小组作用域内的业务提醒记录并入同步队列；`trainingReminderService` 负责通知生命周期；`notificationService` 是 Expo 调度适配层。`notification_ids_json` 是本机运行态，不进入同步 payload。
# v2.7.0 计划动作处方

`PlanExerciseDraft` 是页面草稿，不直接持久化；`buildPlanEditDraft` 从每条 `PlanExercise` 恢复独立字段，`toUpdateUserPlanInput` 再映射为 repository 输入。训练启动创建 snapshot 后，计划修改不会回写 session、record、set 或报告。固定重量处方优先写入 `workout_sets.planned_weight`。本轮不需要迁移或服务端变更。
