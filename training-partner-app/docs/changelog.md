# 变更记录

## 2026-06-28 - title-dedup-liftmark-login

### 标题去重修复
- 账号设置页面移除 Screen 标题，避免与 ProfileSection 标题重复
- 关于练刻页面 ProfileSection 标题改为"关于"，避免与页面标题重复

### 练刻账号登录支持
- 后端 `findUserByAccount` 新增 `liftmark_id` 字段查询
- 现在支持手机号、邮箱、练刻账号三种方式登录

## 2026-06-28 - ui-title-dedup-hero-nav-login-rework

### 二级菜单标题去重
- 训练档案、小组成员、偏好设置页面移除 Screen 标题，避免与内容重复
- 云同步页面移除"开发中 / 可测试"开发者文案

### HeroCard 点击跳转
- 小组名称区域点击跳转到小组成员页
- 当前计划区域点击跳转到计划页
- 新增 onGroupPress 和 onPlanPress 回调

### 登录页重构
- 品牌图标改为文字 Logo（练刻），更清晰
- 登录方式从"手机号+密码"扩展为"手机号/邮箱/练刻账号+密码"
- 输入框标签从"手机号"改为"账号"
- 注册仍使用手机号接收验证码
- 标语改为"记录每次训练，刻下持续进步"

### 其他清理
- 移除手动补录页面的"本地 SQLite"技术描述

## 2026-06-28 - ui-copy-audit

### 头像交互优化
- 点击"我的"页头像直接打开相册选择，不再跳转头像设置页
- 移除 avatar.tsx 路由跳转，改为内联 picker 调用

### 菜单描述去重
- "训练档案"描述改为"体重、力量记录、加重单位"
- "小组成员"描述改为"管理训练成员和角色"
- "偏好设置"描述改为"单位、记录方式、休息计时"
- "账号设置"描述改为"安全、同步、会员"
- "帮助与关于"重命名为"关于练刻"，图标改为 information-circle-outline

### 去除技术术语
- about.tsx：移除"本地优先"、"SQLite"、"预留清晰的边界"等技术描述
- profile/data.tsx：移除"本机 SQLite"、"训练现场不依赖网络"等
- profile/preferences.tsx：移除"偏好优先复用现有本地设置"
- profile/sync.tsx：移除"本地 SQLite 先写"、"训练现场仍然本地优先"
- groups.tsx：移除"本地小组"标签

### 账户安全简化
- 移除"退出所有设备"菜单项
- 注销账号描述改为"删除账号数据，不可撤销"
- 移除"不会删除本机训练数据"等旧版提示

### 数据管理重构
- "隐私与数据"重命名为"数据管理"
- 移除重复的账号注销入口（仅保留在账户安全中）
- 移除"删除云端数据"入口
- 保留"清除所有数据"功能

### 退出登录提示优化
- 移除"本地缓存仍会保留"技术描述
- 改为"退出后需要重新登录才能使用账号相关功能"

## 2026-06-28 - avatar-upload-font-reduction

### 头像上传
- 重设计 `app/profile/avatar.tsx`：移除多余描述和按钮，点击头像直接打开相册选择
- 新建 `src/services/avatar/avatarUploadService.ts` 实际上传服务：本地压缩后上传服务器
- 后端新增 `PATCH /auth/avatar` 接口：接收 avatar_url 并更新 users 表
- 移除 mock upload，改为真实 base64 上传到服务器
- 压缩规则：1024x1024、JPEG 0.86 质量，目标 < 1MB，服务端限制 2MB

### 全局字体缩小
- `src/theme/typography.ts`：display 34→28、headline 28→24、title 22→20、subtitle 17→16、body 15→14、bodySmall 13→12、caption 11→10
- 对应 lineHeight 同步缩减

## 2026-06-28 - bugfix-and-about-redesign

### Bug 修复
- 修复密码登录提示"验证码错误或过期"的问题：`authService.login` 错误使用了 `code_login` scope，已改为 `password_login`，密码错误时正确提示"手机号或密码错误"
- 修复首次安装小米手机时"我的"页面无法加载的问题：`_layout.tsx` 中数据库初始化和用户加载从并发改为顺序执行，确保迁移完成后再导航
- 为 `getAccountProfileCache` 和 `upsertAccountProfileCache` 添加 `CREATE TABLE IF NOT EXISTS` 防护，解决真机上 `account_profile_cache` 表缺失的问题

### 帮助与关于页面重设计
- 移除重复的"帮助与关于"标题（Screen 标题 + ProfileSection 标题）
- 移除"使用帮助"模块
- 移除版本号连续点击 7 次开启开发者模式的功能
- 新增"关于练刻"内容：应用介绍、核心理念说明
- 新增"意见反馈"：联系方式 a2531999713@163.com，支持邮件客户端跳转
- 新增品牌 Hero 区域：品牌色 Logo 标记 + 应用名 + 标语
- 底部显示版本号（不可交互）

### 编译文档
- 新增 `docs/build-guide.md` 编译打包手册：Android Studio 编译、小米手机编译、发行版/测试版编译

## 2026-06-26 - ui-workout-homepage-redesign

### 首页重新设计
- `app/(tabs)/today.tsx` 全面重构为现代 Bento 风格布局
- 新增 Hero 卡片：深色背景 + 品牌色装饰，显示训练主题、计划、动作数、成员数
- 快捷入口改为 3 个图标导航（训练记录、训练分析、切换计划）
- 训练内容以药丸标签展示，替代长列表
- CTA 按钮全宽品牌色设计
- 进度条显示训练完成百分比
- 使用 impeccable skill 设计原则：无边框卡片、品牌色强调、大量留白

### 训练分析页
- `app/history/analytics.tsx` 顶部增加 "History / Analytics" 标题标签
- 标题下方显示 "训练分析" 大标题和成员信息

### 训练中 UI 优化
- `app/workout/[sessionId].tsx` 已完成记录只显示当前成员（过滤 `memberId === currentMemberId`）
- 休息时间改为成员独立（`memberRestState` 替代全局 `isResting`）
- 每个成员可独立跳过休息

### 训练中组件重设计
- `src/components/workout/CurrentSetRecorder.tsx` 移除"跳过动作"按钮
- RPE/RIR 改为折叠式设计，默认不展开，点击切换
- 休息倒计时集成到"跳过休息"按钮上（显示计时器徽章）
- 删除独立的休息倒计时卡片

### 训练中已完成记录
- `src/components/workout/CompletedSetList.tsx` 重设计为 chip 样式
- 重量和次数独立显示，不再被截断
- RPE/RIR 使用品牌色 chip 区分
- 编号徽章更醒目

### 训练中动作列表
- `src/components/workout/WorkoutProgressStrip.tsx` 重设计
- Dock 模式：进度条 + 成员 chip 标签
- Card 模式：垂直卡片列表，每个动作独立一行
- 当前动作高亮（品牌色边框 + "当前"徽章）

### SMS 验证码服务
- 后端配置阿里云 dypns 短信服务
- 服务器返回 `provider: "dypns"` 表示真实短信发送

## 2026-06-24 - phone-code-auth-gate

- `app/account/login.tsx` 改为手机号验证码唯一登录 / 注册表单，删除账号密码入口、继续浏览、预览模式和功能卖点标签。
- `app/_layout.tsx` 和 `app/index.tsx` 增加启动门禁：无 session 进入登录页，有 session 离线进入本机模式。
- `src/store/authStore.ts` 新增 `authStatus`：`checking / unauthenticated / authenticated / offline_authenticated`。
- `src/services/httpClient.ts` 作为业务 API 统一入口，复用 `apiClient` 的 base URL、超时和中文错误映射。
- `src/services/auth/authService.ts` 调整 refresh 失败策略：网络、超时或 5xx 不清空本地 session。
- 首页增加“当前离线，已进入本机模式”提示。
- 更新 auth、UI、settings、handoff、product-design 和 roadmap 文档。

## 2026-06-24 - auth-minimal-login-network-fix

- 极简重做 `app/account/login.tsx`：登录 / 注册首页只保留品牌、价值说明、三个轻量标签、手机号登录 / 注册主入口和账号密码登录次入口；表单后置到下一步。后续已由 `phone-code-auth-gate` 调整为手机号验证码表单唯一入口。
- 重做 `AuthRequiredSheet`：弹窗只做登录价值提示，保留右上角关闭、遮罩关闭和一个“登录 / 注册”主按钮，不再显示“继续浏览”按钮或表单。后续已移除关闭入口。
- `src/services/apiClient.ts` 增加统一超时、非 JSON 响应和网络异常映射；`fetch failed` / `ConnectException` 不再直接展示给用户。
- 验证码发送增加手机号格式校验、发送 loading、60 秒倒计时和中文错误提示。
- 新增 `src/tests/api-client-errors.test.ts` 覆盖网络失败和超时错误映射。

## 2026-06-24 - auth-preview-access-sprint

- 重构 `app/account/login.tsx`：新增账号价值说明、验证码登录、密码登录、注册、本机数据保护提示和云同步开启提示。
- 新增 `src/domain/auth/*`：集中定义 `AuthMode`、`MembershipTier`、`FeatureKey` 和 `decideFeatureAccess()`。
- 新增统一拦截组件 `src/components/auth/*` 与 `src/hooks/useAuthGate.ts`，登录要求和 Pro 要求使用统一弹层。
- `authStore` 增加 `authMode`、会员等级、会员状态、访客预览和同步提示状态；登录后尝试读取后端会员状态，失败时降级为登录免费版。
- 首页、计划、记录、成员、激活码、云同步、训练执行和隐藏探索页的正式写入入口接入权限 gate。
- 访客不再读取真实历史列表、训练详情或高级训练分析；未登录不能创建正式 workout session。
- 新增 `src/services/localDataStatusService.ts` 检测本机成员、我的计划和训练记录，用于登录后本地数据保护提示。
- 新增 `src/tests/auth-access.test.ts` 覆盖访客、免费版、Pro 和退出登录不清本地训练数据策略。
- 数据库影响：未修改 SQLite schema；训练记录仍写入本地 SQLite，不使用 AsyncStorage。

## 2026-06-15 - plan-dashboard-exercise-library-custom-exercise-member-limit-weight-git-sprint

- 系统动作库修复历史中文编码污染并扩展为 100+ 个系统动作，新增 `exercises.source` 区分系统动作和自定义动作。
- 新增统一动作选择器 `ExercisePickerSheet`，支持搜索、系统/我的动作切换、肌群和器械筛选、快速新建自定义动作，并接入历史补录和创建计划。
- 计划页重做为当前计划仪表盘：当前计划进度、本周执行、本周安排、我的计划摘要、计划工具、系统方案和“管理全部计划”弹层。
- `PlanRepository.deleteUserPlan()` 支持删除用户计划，并阻止删除系统方案、当前计划和最后一个用户计划；删除计划不删除训练记录。
- 计划导入按动作名称复用本机已有动作，缺失动作才写入 SQLite，避免重复导入自定义动作。
- 成员上限从 4 人调整为 5 人，并集中到 `src/config/appLimits.ts`。
- 建议重量支持按次数区间保守估算，PPL 这类 RPE/RIR 计划也能给出成员建议重量。
- 新增测试覆盖系统动作库、成员上限、建议重量推算和用户计划删除边界。

## 2026-06-15 - ui-consistency-plan-entry-member-flow-sprint

- 新增 `AppModalSheet` 统一 App 风格底部/居中弹层，替换复制方案、导出内容、导入后设当前和训练页切换计划流程中的粗糙系统提示。
- 探索页重构为数据驱动推荐方案：PPL 入口可复制为我的计划或设为当前，未完成方案收进“更多方案开发中”，创建/导入改为计划工具小卡。
- 计划页右上角加号进入真实创建计划页；系统方案主列表只展示可复制模板；复制方案不再是表单，复制成功后再询问是否设为当前计划。
- 新增只读计划详情页，用户计划可查看计划来源、周期、训练日和动作摘要。
- 训练页切换计划改为底部计划列表 + 二次确认；只列出我的计划，切换后刷新今日训练内容。
- 记录页训练建议文案改为“训练建议”，日期下训练记录摘要卡增加主要动作前 2 个和剩余动作数量。
- 设置页导出全部数据、训练记录、当前计划时明确提示“当前版本暂未保存到文件”，支持复制内容；导入计划使用统一确认弹层。
- 新增成员保存后按来源返回成员列表；达到本地成员上限时新增入口改为本地小组上限说明卡。
- 新增 `expo-clipboard` 依赖用于复制导出内容。

## 2026-06-14 - settings-history-plan-switch-cleanup-sprint

- 设置页顶部接入 LiftMark 品牌专属图；成员资料改为全成员摘要入口；加重单位改为全成员单位摘要入口；移除设置页成员编辑表单、周五策略入口和最近导出 JSON 预览。
- 计划页和设置页接入 `.liftmark.json` 导入：DocumentPicker 选择文件、`planFileService` 校验和 ID 重映射、`PlanRepository.importUserPlan()` 写入 SQLite，导入后可选择设为当前计划。
- 新增系统只读模板“经典三分化 PPL”，seed 写入系统模板，系统方案列表可见并可复制为我的计划；新增测试覆盖系统方案和复制草稿。
- 训练页当前计划卡新增“切换计划”弹层，只列出我的计划，切换后更新当前小组 current plan 并刷新今日训练。
- 记录页最近训练改为移动端摘要卡，展示日期/时长、动作数、完成组数、总训练量、成员口径、PR/估算 1RM/趋势标签，点击进入详情。
- 新增 `expo-document-picker`、`expo-file-system` 依赖用于 Android 本地文件选择和计划文件读取。
- Git 忽略规则补齐 `.expo/`、Android build 目录、APK/AAB/keystore 和环境变量文件。

## 2026-06-14 - 训练执行交互修正 + 记录/设置 UI 重设计 + 图标背景修复

- 训练执行页 RPE/RIR 改为纯 preset 点选：RPE `6-10/清空`，RIR `0-5/清空`，不再显示数值输入框。
- 生成记录页设计稿 `docs/ui/record-page-redesign.png`，并重做 `app/(tabs)/history.tsx`：紧凑个人概览、2x2 指标、基础趋势、可点击日历、最近训练列表和小组汇总开发中隔离提示。
- 生成设置页设计稿 `docs/ui/settings-page-redesign.png`，并重做 `app/(tabs)/settings.tsx`：顶部状态卡、分组设置列表、开发中标签、数据管理、计划管理、诊断和危险操作。
- 搭子页主页面本地小组说明压缩为一句话，完整规则移入“了解本地小组”弹层。
- 修复图标背景资源：`app-icon-1024.png` 改为深色实底；adaptive foreground 保持透明安全边距；splash logo 改为透明居中；`app.json` 顶层 splash 改用 `splash-logo.png`。

## 2026-06-14 - 训练执行体验与记录数据口径修复 v1

- 训练执行页支持完成本组后自动推进：下一组休息倒计时、无休息直接下一组、动作完成后自动下一个动作、最后动作完成后进入总结。
- 重量和次数支持直接输入，保留加减号微调；RPE 支持为空或 6-10，RIR 支持为空或 0-5，非法输入会提示。
- 当前动作已完成组可见，并支持编辑、删除和撤销上一组；编辑使用原 set 更新，避免重复记录。
- 补录训练新增可选间歇秒，留空写入 `null`，不影响训练量、PR 和估算 1RM。
- SQLite 新增 migration v4：`workout_exercise_records.planned_rest_seconds`，用于保存训练动作休息时间快照。
- 记录页默认统计当前成员个人数据，明确显示“当前成员”“我的本周训练量”“我的本周训练次数”“我的本周完成组数”。
- 小组汇总入口显示开发中说明，不混用个人统计；搭子页和设置页补充本地小组与未来云同步规则。
- 估算 1RM 口径收紧为重量 > 0 且次数 1-12。
## 2026-06-14 - 练刻 LiftMark 品牌迁移与图标资源接入

- 品牌统一为“练刻 LiftMark”，App 显示名为“练刻”。
- Android package / applicationId 迁移为 `com.liftmark.app`，`android:open` / `android:preview` 同步新包名。
- Expo `app.json` 更新 `name`、`slug`、`scheme`、icon、adaptive icon、splash 和 favicon。
- 新增 `assets/brand/`、`assets/brand/source/`、`src/assets/brand/`，并生成 App icon、adaptive icon、monochrome icon、splash logo、favicon、页面内品牌图。
- Android 原生 `res` 同步新 icon、adaptive layer、splash logo 和颜色，避免本地 APK 构建依赖重新 prebuild。
- 训练氛围图从 `lifton-*` 重命名为 `liftmark-*`，页面通过 `liftmarkImages` 引用。
- 计划导入导出格式从 `lifton-plan` 迁移为 `liftmark-plan`，推荐文件名 `.liftmark.json`。
- 新增“关于练刻”页面，设置页新增“品牌与版本”卡片。
- 文档新增 `docs/brand/brand-guideline.md`、`docs/ui/liftmark-ui-design-spec.md`；旧 `docs/ui/lifton-ui-design-spec.md` 保留为历史迁移入口。


## 2026-06-12

### ui-image-assets：本地训练图片资产接入

- 影响模块：ui、explore、members、today-training、plan、history、settings、activation、workout summary。
- 修改代码：从 `docs/ui/` 筛选训练图片复制到 App `src/assets/images/`，改为 LiftMark 语义命名；新增 `src/assets/images/index.ts`；`VisualHeroCard` 支持 `imageSource`、本地图片背景和深色遮罩；探索、搭子、训练、计划、记录、成员表单、创建计划、补录训练、激活、设置、训练执行动作卡和训练总结接入本地图片。
- 数据影响：无 SQLite、seed、Repository 或训练记录变更。
- 更新文档：同步 UI 设计规范、UI 模块设计/实现、产品设计、技术架构、开发路线图、changelog 和 handoff。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`npm run android:preview` 已通过；adb 截图确认探索页本地图片 Hero 正常渲染。
- 风险说明：图片作为本地 APK assets 打包，APK 体积会增加约 8.5 MB；后续可按需要压缩或生成多分辨率版本。

### usability-ui-landing：可用性、核心交互和 UI v2 落地

- 影响模块：ui、today-training、history、workout、plan、member、settings、activation、database、local repository。
- 修改代码：训练页支持周五默认休息手动覆盖、Day 1-4、补弱和自由训练；记录页支持日期点击、月视图、某天训练列表、补录训练和历史详情编辑；计划页接入真实创建计划页面；成员表单改为 Hero + 分组卡片 + 两列参数输入；设置页改为卡片化设置中心；新增本地激活码页面和服务；新增 `VisualHeroCard` 与本地视觉资产目录；新增 SQLite migration v3 `friday_strategy_and_activation_state`。
- 数据库影响：`groups` 增加 `friday_strategy`；新增 `activation_state`；训练补录/编辑继续写入 workout 相关表，不使用 AsyncStorage 保存训练数据。
- 更新文档：同步 UI 设计规范、UI/activation/settings/workout/history/plan/member 模块文档、数据库 schema、Repository API、产品设计、技术架构、开发路线图、changelog 和 handoff。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand` 通过；新增 `src/tests/activation.test.ts`。
- 风险说明：导入计划、备份/恢复数据库、远程计划库、计划分享、高级图表和云同步仍为开发中提示；历史编辑第一版提供基础动作切换和组数据编辑，复杂多动作编辑器后续增强。

### plan-scheme-separation：系统方案库与我的计划分离

- 影响模块：plan、group、database、export、today-training、workout。
- 修改代码：新增 `src/domain/plan/systemSchemes.ts` 本地系统方案目录；新增 `src/domain/plan/planCopy.ts` 复制系统模板为用户计划草稿；`PlanTemplate.source` 增加 `system_copy`、`blank_created`、`duplicated`，并增加 `originSchemeId`；新增 SQLite migration v2 `plan_system_scheme_origin`，补 `plan_templates.origin_scheme_id` 并把旧默认系统计划迁移为用户计划副本；seed 首次启动会写入系统模板和默认用户计划副本；`PlanRepository` 新增 `listUserPlans()` 和 `copySystemSchemeToUserPlan()`；计划页调整为“当前计划 / 我的计划 / 系统方案 / 创建计划 / 导入计划”，支持使用完整可用系统方案生成用户计划并设为当前计划。
- 产品原则：系统方案不是用户计划；用户必须点击“使用此方案”后才生成自己的计划；训练记录不能直接绑定系统方案。
- 更新文档：同步 plan 模块 overview/design/principle/implementation/data-flow/test-plan，新增系统方案复制、计划创建、计划导入导出流程文档，并同步产品设计、数据库 schema、Repository API、开发路线图、changelog 和 handoff。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand` 通过；新增计划复制单元测试。
- 风险说明：第一版只完整开放“四练增力增肌方案”；其它系统方案显示“开发中”。创建计划、导入落库、删除计划和深层编辑器仍为后续能力。

### ui-redesign：设计系统、五栏底部导航和核心页面重构

- 影响模块：ui、plan、group、member、workout、history、Android APK 预览。
- 修改代码：新增 `src/theme/*` 主题 token 和 `src/components/ui/*` 基础组件；底部导航调整为“探索 / 搭子 / 训练 / 计划 / 记录”；新增探索页；重构搭子页、训练页、计划页和记录页的信息层级；训练执行页改为不显示底部 Tab 的深色沉浸式页面；训练总结页补充完成度、训练量、成员表现、预估 1RM、下次建议和恢复建议。
- 设计来源：参考图提炼为浅灰页面背景、白色轻阴影卡片、红色训练行动主色、蓝色数据辅助色、8-16px 圆角、清晰数据卡、训练现场大按钮和沉浸式执行页；未复制第三方品牌、图片或具体素材。
- 更新文档：新增 `docs/ui/liftmark-ui-design-spec.md` 和 `docs/modules/ui/*`，同步产品设计、开发路线图、changelog 与 handoff。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`npm run android:preview` 均通过；APK 成功编译、安装并打开；已通过 adb 截图检查探索、搭子、训练、计划和记录页的中文文案、五栏底部导航和核心布局。
- 风险说明：深层计划编辑、动作库详情、邀请搭子、二维码加入、动作替换弹层仍显示“开发中”；本次未修改 SQLite schema、seed 数据和 Repository 抽象。

## 2026-06-11

### stability-ux：品牌中文化、APK 一键预览、设置页、计划导出和历史推算

- 影响模块：Android build、settings、export、plan、history、progression、member、workout、today-training-flow。
- 修改代码：品牌统一为“练刻 / LiftMark”，Android package 调整为 `com.liftmark.app`；新增 `android:install`、`android:open`、`android:preview`；主要用户可见文案中文化；设置页新增基础设置、数据管理、开发/调试信息，周五补弱开关会写入 `groups.friday_enabled`；底部 Tab 显式使用 Ionicons，避免 Android release APK 中默认图标显示为缺字方框；新增 `planFileService.ts` 支持 `.liftmark` 当前计划导出、schemaVersion 校验和导入 ID 重映射；`exportService.ts` 支持全量/训练记录 JSON 字符串导出和默认计划重置；新增 `history-analysis.ts` 支持 Epley 预估 1RM、最近 5 次趋势、PR 接近度、疲劳提示和中文建议；新增进阶建议中文 label 映射。
- 更新文档：同步项目总览、产品设计、技术架构、AI 开发规则、开发路线图、settings/plan/export/history/progression 模块文档和 changelog。
- 测试情况：`npm install`、`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`npm run android:preview` 均通过；APK 成功编译、安装并通过 `adb shell monkey -p com.liftmark.app -c android.intent.category.LAUNCHER 1` 打开，模拟器已截图确认中文首页和设置页。
- 风险说明：`.liftmark` 第一版只生成 JSON 预览，文件保存/分享和导入落库后续接入；清空测试数据暂不执行删除，以避免误删真实训练记录。

## 2026-06-10

### android-apk：新增本地 Android 预览 APK 构建流程

- 影响模块：Android native build、technical-architecture、AI 开发规则、development-roadmap、local SQLite 启动链路文档。
- 修改代码：新增 `android:apk`、`android:apk:device`、`android:apk:universal`、`android:apk:clean`、`android:apk:install` 等 npm scripts；新增 `scripts/clean-android-native.js` 清理 native 构建缓存；在 `android/app/build.gradle` 明确 release 本地预览 APK 使用 debug keystore 签名且不能用于正式发布；将 Gradle daemon metaspace 提升到 1024m。
- 更新文档：同步技术架构、AI 开发规则、开发路线图、本地数据层相关模块实现说明和 changelog。
- 测试情况：`npm install` 成功；`npm run typecheck` 成功；`npm run lint` 成功；`npm run android:clean:native` 成功；`npm run android:apk` 成功生成 `android/app/build/outputs/apk/release/app-release.apk`；`adb install -r android/app/build/outputs/apk/release/app-release.apk` 成功；模拟器首屏打开 Today 页面成功；构建产物包含 `android/app/build/generated/assets/react/release/index.android.bundle`，本地预览 APK 不依赖 Metro。
- 风险说明：`android:apk` 默认构建模拟器常用 `x86_64` 包；真机预览需使用 `npm run android:apk:device`。原生 `gradlew clean` 在一次 native 构建后可能继续尝试清理 `node_modules/react-native-reanimated/android/.cxx` 等生成缓存；按当前“不修改 node_modules”约束，推荐使用 `npm run android:clean:native` 清理项目内 Android 生成目录后直接执行 APK 构建。全架构 release 构建曾在 `react-native-reanimated` 的 `armeabi-v7a` CMake 阶段出现 dirty manifest，正式发版前需要单独处理全架构产物和生产签名。

### android-gradle：修复 JDK toolchain / IBM_SEMERU clean 失败

- 影响模块：Android native build、technical-architecture、local SQLite 启动链路文档。
- 修改代码：在 `training-partner-app/android/gradle.properties` 中增加 `org.gradle.java.installations.fromEnv=JAVA_HOME` 和 `org.gradle.java.installations.auto-download=false`，让 Gradle 只使用本机 `JAVA_HOME` 的 JDK 17，不再触发 toolchain 自动下载路径。
- 更新文档：同步技术架构、AI 开发规则、开发路线图、项目总览、本地数据层相关模块实现说明和 changelog。
- 测试情况：使用 Node.js v24.16.0 / npm 11.13.0 / Microsoft OpenJDK 17.0.19 运行 `cd android && .\gradlew.bat clean --no-daemon` 成功；`npm run typecheck` 成功；`npx expo run:android` 因当前无 Android 设备未进入编译安装阶段。
- 风险说明：`IBM_SEMERU` 相关 Gradle clean 问题已修复；当时 native debug 编译曾受 Windows 中文物理路径和 CMake / Ninja 缓存影响。后续 `android-apk` 条目已将第一阶段验收切换为本地 release APK。

### android-build：切换第一阶段验收到 Android development build

- 影响模块：technical-architecture、database/local、group、member、plan、exercise、workout。
- 修改代码：新增 `expo-dev-client`；`android` script 改为 `expo run:android`，新增 `start:dev-client` 和 `android:clear`；根布局在 Web 平台跳过 native SQLite 初始化；`initializeLocalDatabase()` 改为可复用初始化 Promise；生成 Android native 工程并补充 Gradle UTF-8、路径检查和下载超时配置。
- 更新文档：同步技术架构、AI 开发规则、开发路线图、本地数据层相关模块实现说明和 changelog。
- 测试情况：`npm install` 可完成；当前 Node.js v24.16.0 满足 engine 要求；`npm run typecheck`、`npm run lint`、`npm test -- --runInBand`、`npx expo install --check` 均通过；`npx expo run:android` 需要连接设备或启动模拟器后继续验证。
- 风险说明：第一阶段不以 Web 预览作为验收标准；Web 端 `expo-sqlite/web` 的 wasm 解析问题不影响 Android 主目标。Android 编译需要 Node.js 22.13.0+、64-bit JDK 17；后续 `android-apk` 条目已将当前验收方式调整为本地 release APK。

## 2026-06-09

### sprint-4：实现训练执行页

- 影响模块：workout、member、plan、exercise、weight、workout-execution-flow。
- 修改代码：`createSessionFromTodayPlan` 生成 session、动作快照和每位成员 set；Today 页新增开始训练入口；训练执行页按动作轮换展示成员 set 卡，重量/次数 stepper、RPE/RIR 快捷输入和完成按钮均即时保存 SQLite；新增训练总结页和 workout 单元测试。
- 更新文档：同步 workout 模块文档和测试计划、训练执行流程、数据库 schema、Repository API、开发路径图。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand` 均通过。
- 风险说明：Expo/Android 真机页面烟测未在本环境完成；动作替换、跳过动作和历史页展示仍待后续 Sprint。

### sprint-3：实现默认计划和今日训练

- 影响模块：plan、exercise、weight、recovery、today-training-flow。
- 修改代码：将四练增力增肌 Excel 转为默认 seed；新增 ExerciseRepository；接入 `getTodayPlan` 恢复过滤；实现默认周期/周数设置、今日训练页、成员建议重量和恢复状态切换；新增 plan/weight/recovery 单元测试。
- 更新文档：同步 plan、exercise、weight、recovery 模块文档和测试计划、今日训练流程、数据库 schema、Repository API、开发路径图。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test -- --runInBand` 均通过。
- 风险说明：Expo/Android 真机页面烟测未在本环境完成；Excel seed 的后续版本迁移和重置策略待 Sprint 7 明确。

### sprint-2：实现成员管理

- 影响模块：member、group、weight、onboarding-flow。
- 修改代码：新增成员表单校验、成员列表卡片、成员表单、成员列表页、新增成员页、编辑成员页；配置 `jest-expo` 并新增成员单元测试。
- 更新文档：同步项目总览、技术架构、开发路径、member 模块文档、首次使用流程。
- 测试情况：`npx expo install --check`、`npm run typecheck`、`npm run lint`、`npm test` 均通过。
- 风险说明：Android 真机关闭重开后的成员持久化烟测未在本环境验证；成员删除策略仍待确认。

### sprint-1：创建 Expo 项目骨架和本地数据库骨架

- 影响模块：database、group、member、plan、workout、progression、weight、recovery、export、history。
- 修改代码：创建 `training-partner-app/`，配置 Expo Router、TypeScript、ESLint、Prettier、Jest、Expo SQLite；创建 `src/domain` 基础类型、SQLite schema/migrations、Repository 接口与本地实现骨架、`seedDefaultData` 入口。
- 更新文档：同步项目总览、技术架构、开发路径、数据库 schema、Repository API 和相关模块实现说明。
- 测试情况：`npm run typecheck`、`npm run lint`、`npm test` 均通过；当前无测试用例。
- 风险说明：Android 真机启动未在本环境验证；默认四练 Excel 计划尚未完整导入 seed，且没有硬编码到 React 组件。

## 2026-06-08

### docs：初始化 AI 文档驱动开发文档体系

- 影响模块：全部文档模块。
- 修改代码：无，本次未写业务代码。
- 更新文档：创建 `docs/` 下项目总览、产品设计、技术架构、开发路线、模块文档、流程文档、数据库文档、Repository API 文档和 ADR。
- 测试情况：文件结构检查通过。
- 风险说明：当前文档基于需求文档、开发文档和 Excel 训练计划，业务源码尚未创建，后续实现时需以代码为准同步更新。
