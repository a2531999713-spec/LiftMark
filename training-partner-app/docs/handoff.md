# LiftMark 项目交接记录

## 2026-06-30 cloud-first-workout-history-stability 交接

- 当前项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；后端路径：`C:\Users\zhw\Documents\LiftMark\apps\liftmark-api`。
- 架构方向：云端 PostgreSQL 为主数据源，本地 SQLite 为缓存、副本和弱网训练保障；不要再按“本机唯一真源”设计新功能。
- 移动端新增 migration v10：同步元数据字段和 `local_sync_queue`；`src/sync/syncQueue.ts` / `src/sync/syncService.ts` 已能统计、入队、推送 `/api/sync/push` 并标记成功 / 失败。
- 训练执行页：小组轮换按“set number 优先、成员顺序其次”；完成本组必须校验重量/次数并保存当前 set，保存失败不推进。
- 短训练结束：完成动作少、组数少、时间少、总量为 0 或多数动作未完成时弹窗确认继续训练 / 保存记录 / 放弃本次。
- 个人记录页：改为分析导向，支持动作筛选、日历当天记录和训练查询；点击日期不再触发整页 reload。
- 小组记录：动作卡默认展示训练容量趋势；动作详情标题显示“动作 + 指标”。
- 成员表单：删除解释区；保存按钮按变更和校验状态启用。
- 图表：`MiniLineChart` / `MultiLineTrendChart` 横轴标签自动抽样，避免手机窄屏堆叠。
- 下一步建议：把 groups、group_members、member_profiles、plan_templates、body_metrics 按现有 `SyncEntity` 契约逐步接入队列，并在后端补齐资源化 API 或扩展 `/sync/push` schema。

## 2026-06-30 charts-body-groups-workout-replacement 交接

- 当前项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`。
- 图表：`MiniLineChart` / `MultiLineTrendChart` 已修复绘图区 padding、Y 轴比例、同值/全 0 安全范围、单位和空状态；周趋势使用日期或周起始日期。
- 身体数据：`app/profile/body-metrics.tsx` 已重构为快速记录、折叠围度、目标设置、变化摘要、训练关联和趋势图；新增 `body_metric_goals` 和 migration v9。
- 头像：根因是账号头像缓存与训练成员 profile 分表；账号头像更新/删除时同步当前小组第一位训练成员，训练、记录、小组分析统一使用 `Avatar`。
- 多小组：`GroupRepository.listGroups()` 已接入小组页、今日、成员、记录、设置、头像和身体数据页；新建小组后可立即切换，旧训练记录保留原 `group_id`。
- 小组记录：默认展示总览，动作表现选择器列出真实练过的 `exerciseId`，详情页按当前小组和真实动作 ID 过滤。
- 训练执行：RPE 是可选折叠横向选择器；休息面板显示倒计时、建议休息、已休息、下一组和下一位，并保存实际休息秒数；训练中替换动作保留 `replaced_from_exercise_id`，不改原计划。
- 已验证：`npx tsc --noEmit --pretty false`、`npm run lint`、`npm test -- --runInBand`。
- 仍建议手工回归：多小组切换后的今日训练、记录页、成员页和身体数据页；头像重启后展示；训练中替换动作后历史详情的“由 A 替换为 B”；Android 预览安装启动。

## 2026-06-30 my-secondary-pages-history-workout-body-metrics 交接

- 当前项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`。
- 已完成：二级页面统一 `SecondaryPageHeader`、头像默认成员同步、历史图表 Y 轴与训练次数轴、个人动作历史页、小组动作容量默认指标、训练 RPE/备注/实际休息、身体数据录入与趋势。
- 数据迁移：migration v8 添加 `workout_sets.actual_rest_seconds` 和 `body_metrics`；新安装 schema 已同步。
- 已验证：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`npm run android:preview`。
- `android:preview` 已完成 release APK 构建、安装并通过 adb monkey 启动；仍建议手工检查二级页顶部、训练休息计时和身体数据页面的视觉细节。

## 2026-06-30 training-switch-onboarding-mainstream-plans 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；命令在该目录执行。
- 今日训练页会用最新 `selectedWeek` / `selectedWeekday` 重新解析计划日，再打开训练范围选择或创建 session；不要再直接依赖旧 `todayPlan` 缓存。
- 同一天有未完成训练时，只有同计划、同周次、同训练日、同记录模式才继续复用；不同选择必须由用户确认继续旧训练、放弃旧训练或返回。
- 系统方案目录为主流计划库；旧四练 seed 和 migration 仅为历史兼容，不要作为新用户默认计划、推荐计划或系统方案展示。
- 新用户登录后进入 `/onboarding/training-profile`，填写训练信息并使用 `recommendPlans()` 选择计划；使用后复制系统方案为用户计划并更新默认小组当前计划。
- 头像统一走 `src/components/avatar/Avatar.tsx`，成员列表、训练首页、执行页、总结页和历史小组分析都应复用该组件。
- 小组动作详情页为 `app/history/group-exercise/[exerciseId].tsx`，数据来自本机 SQLite session 明细，不显示旧强度字段。
- 退出登录只保留在 `app/account/settings.tsx`，确认后清理账号 session 并跳转登录页，不删除本机训练记录。

## 2026-06-29 auth-code-home-scope-consent 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；命令在该目录执行。
- 登录页 `app/account/login.tsx` 当前为手机号 + 短信验证码登录 / 注册一体入口；移动端不再展示密码登录、密码注册和找回密码入口。
- 验证码用于登录、自动创建账号和后续绑定类能力；`authStore.sendCode()` 不再把 `debugCode` 暴露到 UI。
- 首页 `app/(tabs)/today.tsx` 前置计划周次 / 训练日选择和动作筛选；临时切换不修改 `groups.current_week`，动作筛选会影响本次 session 的动作快照。
- 自由训练入口走现有 `app/history/manual.tsx` 补录流程，不创建空动作 session。
- 开始训练前必须选择记录范围：`solo_local` 或 `group_local`，并选择参与成员。
- SQLite migration v7 新增 `workout_sessions.training_mode`，旧 session 默认 `group_local`；补录 session 默认 `solo_local`。
- `WorkoutRepository.createSessionFromTodayPlan()` 支持 `participantMemberIds`，只给参与成员生成 `workout_sets`。
- 训练执行页和总结页按本次 sets 过滤参与成员；总结页小组同步确认卡仅说明授权边界，成员确认和服务器同步仍为预留流程。

## 2026-06-28 profile-password-auth-avatar-sprint 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；所有命令执行前先 `cd` 到该路径。
- 登录页 `app/account/login.tsx` 当前为双态账号表单：登录使用手机号/邮箱/练刻账号 + 密码；注册使用手机号 + 验证码 + 密码 + 昵称。
- 验证码用于注册绑定手机号，后续用于手机号换绑 / 找回密码等敏感流程；当前 UI 不把验证码登录作为唯一登录方式。
- 当前 UI 不展示继续浏览、预览模式、验证码一键登录、第三方登录、会员权益或小组协作卖点。
- "我的"页 `app/(tabs)/settings.tsx` 当前按参考图重做：深色账号主卡、训练档案、小组成员、偏好设置、账号设置、关于练刻、退出登录。HeroCard 小组和计划区域可点击跳转。
- 账号头像与训练成员头像分离；账号头像走 `app/profile/avatar.tsx`、`src/components/avatar/*`、`src/services/avatar/*` 和 `account_profile_cache`。点击头像直接打开相册选择并上传服务器。
- 头像压缩后上传服务器，SQLite 只保存 URL、缩略图 URL、本地缓存路径和更新时间。
- 根布局 `app/_layout.tsx` 根据 `authStatus` 做路由保护：无 session 跳转 `/account/login`；有 session 且离线进入本机模式。
- 登录拦截弹窗 `AuthRequiredSheet` 不再显示关闭入口或“继续浏览”文案，只保留登录按钮。
- 真实认证仍复用 `src/services/auth/*` 和 `src/store/authStore.ts`，token 存储在 SecureStore；后端不可用时本地训练不被阻断。
- API base URL 仍集中在 `src/config/api.ts`，默认 `http://47.100.239.29/api`；业务服务通过 `src/services/httpClient.ts`，底层由 `src/services/apiClient.ts` 转换中文错误。
- `src/domain/auth/access-control.ts` 集中管理未登录、免费版、Pro 和永久会员权限，不要在页面里新增散落规则。
- 新增 `src/components/auth/*` 和 `src/hooks/useAuthGate.ts`，页面应通过 `guardFeature()` 和统一 sheet 做登录/Pro 拦截。
- 已接入拦截的关键路径包括首页开始训练、计划创建/导入/复制/导出、记录补录/编辑/分析、成员新增/编辑、激活码、云同步和隐藏探索页写入入口。
- 未登录不能进入主 Tab；有本地 session 离线重启时可以进入默认主界面，但不拉取云端完整数据、不做全量同步。
- 本次新增 SQLite migration v6，用于账号资料缓存和成员头像字段；未把训练记录改存 AsyncStorage，未让训练执行依赖网络。

## 2026-06-15 plan-dashboard-exercise-library-custom-exercise-member-limit-weight-git-sprint 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；所有命令执行前先 `cd` 到该路径并用 `Get-Location` 校验。
- 本次未修改 Android package，仍为 `com.liftmark.app`；未做登录、云同步、饮食、视频/GIF、品牌改名或 node_modules 修改。
- 系统动作库已修复历史中文编码污染并扩展为 100+ 个系统动作；SQLite migration v5 新增 `exercises.source`，区分 `system` 和 `custom`。
- 统一动作选择器 `src/components/exercises/ExercisePickerSheet.tsx` 已接入历史补录和创建计划，支持搜索、系统/我的动作切换、肌群/器械筛选和快速新建自定义动作。
- 计划页已重做为当前计划仪表盘：本周执行、本周安排、我的计划摘要、计划工具和系统方案；“管理全部计划”弹层支持删除用户计划。
- 删除用户计划只删除计划模板/阶段/训练日/计划动作；系统方案、当前计划和最后一个用户计划会被阻止删除；训练记录不删除。
- 计划导入按动作名称复用本机已有动作，缺失动作才写入 SQLite，避免重复导入自定义动作。
- 本地小组成员上限从 4 调整为 5，集中配置在 `src/config/appLimits.ts`。
- 训练页建议重量支持按百分比或目标次数区间保守估算，缺少 1RM 或孤立动作会显示更明确提示。

## 2026-06-15 ui-consistency-plan-entry-member-flow-sprint 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；所有命令执行前先 `cd` 到该路径并用 `Get-Location` 校验。
- 本次未修改 Android package，仍为 `com.liftmark.app`；未做登录、云同步、饮食、视频/GIF、品牌改名或 node_modules 修改。
- 新增统一弹层组件 `AppModalSheet`：复制方案、导入后设当前、导出内容复制、训练页切换计划确认统一使用 App 风格卡片/底部弹层。
- 探索页 PPL 入口已接入系统方案复制和设当前流程；推荐方案不再铺满未完成列表，创建/导入收进“计划工具”小卡。
- 计划页右上角加号进入真实创建计划页；系统方案只展示可复制模板；复制方案不再显示表单；用户计划可进入只读计划详情。
- 训练页切换计划只列出“我的计划”，选择后先确认再切换，切换后刷新今日训练内容，历史记录不受影响。
- 记录页日期下训练记录压缩为摘要卡，显示主要动作前 2 个和剩余数量；训练建议文案改为基础规则说明。
- 设置页导出计划/数据时明确提示当前版本暂未保存文件，并支持复制内容；不常驻显示 JSON 预览。
- 新增成员保存后自动返回成员列表；达到本地成员上限时新增入口显示本地小组上限说明。
- 本次新增依赖：`expo-clipboard`，用于复制导出 JSON 内容。

## 2026-06-14 settings-history-plan-switch-cleanup-sprint 交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`。
- Android package 仍为 `com.liftmark.app`，本次未修改 App 名称、品牌、启动图、桌面图标或 package。
- 设置页顶部已使用 LiftMark 品牌专属图；设置页只做成员资料和加重单位入口/摘要，不再内嵌成员编辑表单，不显示“保存成员”或“稍后补充”。
- 设置页不再暴露“周五策略”，`groups.friday_strategy` 仍保留用于兼容；设置页不再常驻显示最近导出 JSON 预览。
- 计划导入已接入 `.liftmark.json` 文件选择、校验、ID 重映射和 SQLite 落库；导入结果为 `source: "imported"` 的用户计划，可选择设为当前计划。
- 系统方案新增只读模板“经典三分化 PPL”，用户必须通过“使用此方案”复制为我的计划后才能训练。
- 训练页当前计划卡可打开“切换计划”弹层，只列出我的计划；切换不会修改历史训练记录。
- 记录页训练查询改为摘要卡，点击进入 `app/history/[sessionId].tsx`。
- 当前 Git 根目录检查结果：仓库根在 `C:\Users\zhw\Documents\LiftMark`，项目内没有单独 `.git`，未发现 `training-partner-app\training-partner-app` 嵌套残留；仓库当前追踪内容仍位于 `training-partner-app/` 下和根 `.gitignore`。
- 本次新增依赖：`expo-document-picker`、`expo-file-system`，已通过 `npx expo install` 写入 package 文件。

## 2026-06-14 训练执行交互与 UI 重设计交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`。
- 本次未修改 Android package，仍为 `com.liftmark.app`；未做登录、云同步、饮食模块或品牌迁移。
- 训练执行页只保留重量、次数、完成/跳过和备注，不再展示旧强度快捷输入。
- 记录页已按 `docs/ui/record-page-redesign.png` 重做：当前成员个人口径、概览卡、紧凑指标、基础规则建议、可点击日历、训练列表；小组汇总仍显示开发中。
- 设置页已按 `docs/ui/settings-page-redesign.png` 重做：顶部状态卡 + 分组列表；导出、计划重置、激活、诊断和调试保护入口保留。
- 搭子页主页面只显示一句本地小组说明，完整规则在“了解本地小组”弹层。
- 图标背景修复已完成：桌面图标深色实底，adaptive 前景透明安全边距，splash logo 透明居中，`app.json` 顶层 splash 已切到 `assets/brand/splash-logo.png`。

## 2026-06-14 训练执行体验与记录口径交接

- 当前实际项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；用户任务中出现的 `C:\Users\zhw\Documents\LiftOn\training-partner-app` 在本机不存在。
- Android package 仍为 `com.liftmark.app`，本次未修改 App 图标、品牌、Android package、登录、激活码、云同步或饮食模块。
- 训练执行页已支持完成本组自动推进、休息倒计时、跳过休息、直接输入重量/次数、完成情况 留空和范围校验、已完成组编辑/删除/撤销。
- 新增 SQLite migration v4：`workout_exercise_records.planned_rest_seconds`。旧记录该字段可为 null。
- 补录训练的休息时间可为空，空间歇不影响训练量、PR 和估算 1RM。
- 记录页默认统计当前成员个人数据；小组汇总暂未实现，只显示开发中说明。
- 当前小组仍是本地小组：适合同一台设备多人轮换记录，数据保存在本机，不会自动同步到其他手机；当前版本组长可以查看本机保存的所有本地成员训练数据。
- 未来云同步版本再做账号登录、邀请成员、多设备同步和授权共享数据。
## 2026-06-14 LiftMark 品牌迁移交接

- 当前品牌：练刻 LiftMark。
- 当前 Android package：`com.liftmark.app`。
- 当前一键预览：`npm run android:preview`。
- 当前计划导出：`.liftmark.json` / `liftmark-plan`。
- 新增品牌资源目录：`training-partner-app/assets/brand/`、`training-partner-app/src/assets/brand/`。
- 当前项目目录为 `C:\Users\zhw\Documents\LiftMark\training-partner-app`。


更新时间：2026-06-12

## 1. 当前状态

- App 品牌：练刻 / LiftMark。
- 当前主要验收方式：Android 本地预览 APK，命令为 `npm run android:preview`。
- SQLite、Repository、seed 默认训练计划仍是本地数据核心。
- 底部主导航已调整为：探索、搭子、训练、计划、记录。
- 计划模块已区分系统方案和用户计划：系统方案不会直接执行，用户点击“使用此方案”后才复制为我的计划。
- 记录页已支持个人 / 小组切换；小组汇总基于本机 SQLite 训练记录推导。
- 用户可见的云同步、数据同步、在线邀请和二维码加入入口已从主流程隐藏；底层预留代码不作为当前用户功能展示。
- 可用性 + UI 落地 Sprint 已补齐核心交互：训练页周五覆盖、记录日历、补录、历史编辑、创建计划、设置页卡片化和本地激活码。
- 核心页面已接入 App 本地训练图片资产，图片来自项目 `docs/ui/` 参考素材并复制到 `src/assets/images/` 后用 LiftMark 语义名称引用。
- 新增 SQLite migration v3：`groups.friday_strategy` 和 `activation_state`。

## 2. 最近完成

- 新增 UI 设计规范：`docs/ui/liftmark-ui-design-spec.md`。
- 新增 UI 模块文档：`docs/modules/ui/overview.md`、`design.md`、`implementation.md`。
- 新增主题系统：`src/theme/colors.ts`、`spacing.ts`、`typography.ts`、`radius.ts`、`shadows.ts`、`index.ts`。
- 新增基础 UI 组件：Screen、AppText、AppCard、AppButton、SectionHeader、Tag、MetricCard、ActionCard、EmptyState、SettingsRow、DangerZone。
- 新增本地图片资产映射：`src/assets/images/index.ts`，`VisualHeroCard` 支持图片背景和深色遮罩。
- 重构探索、搭子、训练、计划、记录、训练执行和训练总结页面。
- 训练执行页改为深色沉浸式全屏页面，不显示底部 Tab。
- 计划页已调整为当前计划、我的计划、系统方案和收纳式计划操作弹层。
- 记录页、训练分析页和计划页执行趋势统一使用折线趋势。
- 新增本地系统方案目录和系统方案复制为用户计划能力。
- SQLite migration v2 增加 `plan_templates.origin_scheme_id`，默认小组当前计划指向用户计划副本。

## 3. 运行与验证

推荐命令：

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm run android:preview
```

已验证：

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm test -- --runInBand` 通过。
- `npm run android:preview` 可编译、安装并打开 App。
- adb 截图已检查探索、搭子、训练、计划和记录页。
- `npm run typecheck`、`npm run lint`、`npm test -- --runInBand` 已在可用性 + UI 落地 Sprint 后通过。
- 本地图片资产接入后，`npm run android:preview` 再次通过；adb 截图确认探索页图片 Hero 正常渲染。

## 4. 仍需注意

- 未实现的深层功能应收进说明卡、开发中标签或二级入口，不能做成显眼按钮后只弹系统 Alert。
- 复杂选择流程使用 App 风格底部弹层或卡片，不用系统 Alert 承载。
- 不要把训练计划硬编码进 React 页面组件。
- 不要把系统方案直接当作用户计划。
- 训练记录不能直接绑定系统方案，只能绑定用户计划或训练时计划快照。
- 不要用 AsyncStorage 保存训练记录。
- 不要修改 `node_modules`。
- 不要破坏 Android / iOS native SQLite 实现。

新增人工回归重点：

- 周五默认休息时选择 Day 1-4、补弱和自由训练能开始训练。
- 记录页日期点击、月视图、补录训练、详情编辑和删除确认。
- 记录页个人 / 小组视角切换，小组成员贡献、趋势和最近记录是否来自真实训练数据。
- 激活码 `LIFTMARK-TEST-2026` 关闭重开后仍保持已激活。

## 5. 下一步建议

下一步建议进入 Sprint 5：动作替换和训练完成增强。

优先实现：

- 动作替换弹层。
- 替换后的 `exercise_id` 保存。
- `replaced_from_exercise_id` 历史保留。
- 跳过动作与下一个动作的完整状态处理。
- 训练完成后的总结数据回归检查。

并行补充：

- 成员新增/编辑后关闭重开 App 的持久化烟测。
- 训练执行页中途退出再进入烟测。
- 五个主 Tab 在不同 Android 尺寸下的视觉回归检查。
- 图片 Hero 在小屏 Android 上的文字遮罩、裁切和 APK 体积回归检查。

## 2026-07-01 personal-history-plan-auth-records-sprint 交接

- 当前项目路径：`C:\Users\zhw\Documents\LiftMark\training-partner-app`；后端路径：`C:\Users\zhw\Documents\LiftMark\apps\liftmark-api`。
- 个人历史页已删重复“训练查询”区块；动作筛选仍作为趋势和当天记录的数据源，个人详情入口继续带 `scope=personal&memberId=...`。
- `app/history/manual.tsx` 已支持多动作、多组独立重量/次数补录；`WorkoutRepository.createManualSession()` 同步支持 `exercises` 输入，旧 `exerciseId + setCount` 兼容保留。
- `app/history/[sessionId].tsx` 已支持已完成记录右上角编辑、详情内新增动作、新增组、删组和基础信息保存；个人口径只编辑当前成员 sets，小组口径新增组按本次参与成员追加。
- 动作历史页已移除平均 RPE 和 RPE 趋势图；训练执行仍可保存可选 RPE 作为高级 set 字段。
- 今日训练页默认自动跟随到当前计划下一个未完成训练日；用户手动选择周/日后保持手动选择。
- 计划首页只保留当前计划、周进度、安排和操作入口；计划详情右上角为操作菜单；`app/plan/create.tsx` 支持多训练日创建和 `editPlanId` 编辑用户计划。
- 新增 `PlanRepository.updateUserPlan()`，会替换用户计划的 phase/day/exercise 结构；系统方案仍禁止直接编辑。
- 移动端密码登录改用后端 `/auth/password/login`；后端 `/auth/login` 继续兼容旧 `account` 请求体。
- 普通 App 页面已移除“本机 / 本地”技术化文案，保留隐私/同步场景中的“当前设备”表达。
- 已验证：移动端 `npm run typecheck`、`npm run lint`、`npm test -- --runInBand`；后端 `npm run typecheck`、`npm run build`。
- 未执行：`npm run android:preview`，本次未构建 Android 预览包。
