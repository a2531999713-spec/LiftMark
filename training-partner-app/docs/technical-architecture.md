# 技术架构文档
## 2026-06-14 品牌与 Android 包名迁移

- Expo `app.json`：`name` 为“练刻”，`slug` / `scheme` 为 `liftmark`。
- Android `namespace` / `applicationId`：`com.liftmark.app`。
- Android Kotlin 源码包路径：`android/app/src/main/java/com/liftmark/app/`。
- `package.json` 一键预览脚本打开 `com.liftmark.app`。
- 品牌图标、adaptive icon、splash、favicon 位于 `training-partner-app/assets/brand/`；Android 原生 res 已同步，`npm run android:apk` 不依赖重新 prebuild。
- 第一阶段仍以 Android 本地 APK 预览为验收方式，不以 Web 预览为验收标准。


更新时间：2026-06-11

## 1. 架构概览

目标架构是 React Native + Expo + TypeScript 的本地优先移动 App。数据写入以 Expo SQLite 为准，Domain 层承载训练计划、重量计算、进阶建议、恢复评分等核心逻辑，UI 只负责展示和输入。

```text
UI / App Routes
  -> Components
  -> Store
  -> Domain Services
  -> Repository Interfaces
  -> SQLite local repositories
  -> Future Sync Layer
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

第一阶段主要验收目标切换为本地 Android 预览 APK：不依赖 Web 预览、不依赖 Expo Go，也不要求启动后连接 Metro。推荐运行方式：

```powershell
cd C:\Users\zhw\Documents\LiftOn\training-partner-app
npm install
npm run android:preview
```

`npm run android:preview` 会执行 `android:apk`、`android:install` 和 `android:open`，完成“编译 APK -> 安装 APK -> 打开 App”。`npm run android:apk` 默认构建本机模拟器预览用的 `x86_64` release APK，并在 release 构建中通过 `createBundleReleaseJsAndAssets` 将 `index.android.bundle` 和 assets 打进 APK。真机预览可使用 `npm run android:apk:device` 构建 `arm64-v8a` 包；如需全架构包可使用 `npm run android:apk:universal`，但全架构 native 编译更慢，且更容易暴露 NDK/CMake 缓存问题。

development build 仍作为后续可选调试方式保留：

```powershell
npm run android:build
npm run start:dev-client
```

development build 需要 Metro；本地预览 APK 不需要 Metro。当前阶段不依赖 Expo Go 自动下载，也不为了 Web 预览替换 SQLite。`expo-sqlite` 保留为 Android / iOS 的 native 本地数据库方案；Web 端 `expo-sqlite/web` 的 `wa-sqlite.wasm` 解析问题不影响 Android 主目标。

本地 Android build 推荐环境：

- Node.js 22.13.0 或更高版本；当前已验证 Node.js v24.16.0 / npm 11.13.0 满足要求。
- 64-bit JDK 17；当前推荐 `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`，不要切到 Java 24。
- Android SDK Platform 36、Build Tools 36、NDK 27.1。
- Gradle 通过 `JAVA_HOME` 发现 JDK 17，并关闭 toolchain 自动下载，避免 React Native Gradle Plugin 的 Foojay resolver 在 Gradle 9.3.1 下触发 `JvmVendorSpec.IBM_SEMERU` 兼容错误。
- 当前本地预览 APK 已在 `C:\Users\zhw\Documents\LiftOn\training-partner-app` 下通过 `x86_64` release 构建和模拟器首屏烟测。若后续 native module 再出现 CMake / Ninja 缓存异常，先执行 `npm run android:apk:clean` 清理 `android/app/.cxx`、`android/app/build`、`android/build` 等项目内生成目录后重建。原生 `gradlew clean` 在一次 native 构建后可能继续尝试清理 `node_modules/react-native-reanimated/android/.cxx` 等生成缓存；在“不修改 node_modules”的约束下，不把 raw `gradlew clean` 作为本阶段 APK 验收步骤。
- Android package / applicationId：`com.liftmark.app`。

## 3. 后端架构

第一阶段无强制后端。Repository 层必须预留 remote sync 边界，第二或第三阶段接 Supabase。

后续候选：

- Supabase Auth。
- Supabase PostgreSQL。
- Supabase Storage。
- Supabase Edge Functions。
- Supabase Realtime，可选。

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

`initializeLocalDatabase()` 在 native runtime 中执行 migrations 和 `seedDefaultData()`，并使用可复用初始化 Promise，避免首屏 layout 和页面数据读取同时触发重复初始化。Web 平台会跳过根布局的 native SQLite 初始化；Web 完整兼容后续单独评估。

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

第一阶段不做账号登录。模型保留 `ownerUserId`、成员 role 和后续 Supabase Auth 接入空间。

## 8. 文件存储

第一阶段无用户上传图片/视频文件存储。当前 UI 使用随 APK 打包的本地图片资产，位于 `src/assets/images/`，用于探索、搭子、训练、计划、记录、设置、激活和训练总结等 Hero 场景；这些资产不进入 SQLite，也不参与计划 seed。后续动作视频、头像、导出备份可接 Supabase Storage。

计划文件第一版推荐 `.liftmark.json`，内容为开放 JSON schema，并预留 `.json`、`.liftmark`、`.liftmark.zip`。`src/services/planFileService.ts` 负责生成、校验和导入 ID 重映射；计划文件只导出用户计划相关的 PlanTemplate、PlanPhase、PlanDay、PlanExercise、Exercise、ExerciseAlternative 和 ProgressionRule，不导出系统方案、训练记录或成员 1RM。

## 9. 第三方服务

- 第一阶段：无必须联网服务。
- 第二/三阶段：Supabase。
- 远期：Apple Health、Garmin、Fitbit、小米/华为运动健康等健康数据源。

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
- 清空数据必须二次确认。
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
- 本地 SQLite 优先。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。
- Excel 训练计划只整理为后续 seed 数据设计说明，不硬编码进页面组件。

Excel 训练计划的 seed 设计映射：

| Excel Sheet | 目标 seed/模块 | 说明 |
|---|---|---|
| 参数输入 | `member_profiles`、group 当前状态 | 1RM、加重单位、当前周期、周数、周五设置 |
| 增力周期总览 | `defaultStrengthPlan.ts` | 周推进、RPE、百分比和减量 |
| 增力_每日计划 | `plan_days`、`plan_exercises` | 增力日动作框架和 A/B/C |
| 增力_按周展开 | `plan_days`、`plan_exercises` | 不同周主项组次和百分比 |
| 增肌周期总览 | `defaultHypertrophyPlan.ts` | 增肌目标、RIR、双进阶 |
| 增肌_每日计划 | `plan_days`、`plan_exercises` | 胸/背/肩/腿动作 |
| 增肌_按周展开 | `plan_phases` 和周策略字段 | 每周容量、RIR、A/B/C 取舍 |
| 周五补弱菜单 | seed 补弱训练日/动作组 | 根据补弱重点选择 |
| 动作替换库 | `defaultAlternatives.ts` | 替代动作关系 |
| RPE_RIR说明 | glossary / 帮助文案 | 强度解释 |
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
