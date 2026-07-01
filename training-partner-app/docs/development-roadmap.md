# 开发路径图

## 2026-07-01 personal-history-plan-auth-records-sprint

- 已完成：个人历史删除重复训练查询区块，动作筛选用于趋势和当天记录，个人详情严格按当前成员过滤。
- 已完成：历史补录支持多动作、多组独立数据；历史详情支持已完成记录新增动作、新增组、删组和基础信息编辑。
- 已完成：动作历史移除 RPE 指标与趋势图，保留训练容量、最佳重量和估算 1RM。
- 已完成：今日训练自动跟随当前计划下一个未完成训练日，手动周/日选择仍可覆盖。
- 已完成：计划首页瘦身，计划详情右上角改为操作菜单，创建页支持多训练日和编辑用户计划。
- 已完成：移动端密码登录改用 `/auth/password/login`，登录页增加密码显示切换；后端保留旧 `/auth/login`。
- 后续：把计划编辑的动作级参数扩展到每个动作独立组数/次数/强度；接入 Android 预览和真实设备回归；把更多同步实体纳入云端队列。

## 2026-06-30 cloud-first-workout-history-stability

- 已完成：产品和技术方向改为云端优先 + 本地缓存副本，文档不再把 SQLite 写成唯一真源。
- 已完成：SQLite migration v10 增加同步元数据字段和 `local_sync_queue`。
- 已完成：训练 session / set 保存后进入同步队列，`syncService` 可把队列推送到现有 `/api/sync/push`。
- 已完成：训练执行页修复组轮换、当前组显示、保存失败不推进、重量/次数异常校验和短训练结束确认。
- 已完成：个人记录页改为分析导向，支持动作筛选；点击日历不触发整页 reload。
- 已完成：小组动作默认训练容量指标，图表标题包含动作 + 指标。
- 已完成：图表横轴标签自动抽样；成员表单删除解释区并状态化保存按钮。
- 后续：把 groups、group_members、member_profiles、plan_templates、body_metrics 接入同步队列；服务端补齐资源化 CRUD 或扩展通用 sync schema；加入端到端同步回归。

## 2026-06-30 charts-body-groups-workout-replacement

- 已完成：折线图比例、绘图区 padding、Y 轴刻度、单位、空状态和周起止日期标签修复。
- 已完成：身体数据页升级为快速记录、折叠围度、目标设置、变化摘要、训练关联和趋势图；新增身体目标表与 Repository。
- 已完成：头像根因修复，账号头像缓存同步当前训练成员 profile，训练、记录、小组分析统一头像组件。
- 已完成：小组页支持创建新小组和切换当前小组；今日训练、成员、记录、设置、头像和身体数据跟随当前小组。
- 已完成：小组记录默认总览，动作选择器按真实练过的 `exerciseId` 展示，不再默认某个动作。
- 已完成：训练中 RPE 折叠横向选择、休息面板增强和训练中替换动作。
- 后续：替换原因/备注字段、更多小组管理操作、跨设备小组同步和更完整端到端自动化仍待后续版本。

## 2026-06-30 training-switch-onboarding-mainstream-plans

- 已完成：今日训练页使用最新手动周次 / 训练日重新解析计划，开始训练不再回退到旧周次缓存。
- 已完成：开始训练行动卡上移；头像统一接入训练页、成员页、执行页、总结页和小组历史分析。
- 已完成：系统方案目录改为主流计划库，旧四练模板仅保留 legacy 兼容。
- 已完成：新增训练资料 onboarding 与推荐计划逻辑；使用推荐计划后复制为用户计划并设为当前计划。
- 已完成：小组动作数据可点击进入详情；退出登录归入账号设置；普通二级页清空默认 Stack 标题。
- 后续：推荐计划详情预览、更多动作级筛选和真实多设备成员确认仍待后续版本。

## 2026-06-29 auth-code-home-scope-consent

- 已完成：登录页恢复为手机号 + 短信验证码登录；新手机号由后端验证码登录接口自动创建账号。
- 已完成：首页训练页前置当前计划、周次、训练日和动作筛选，压缩今日摘要与周概览。
- 已完成：开始训练前选择记录范围和参与成员；本次 session 只给参与成员生成训练组。
- 已完成：SQLite v7 新增 `workout_sessions.training_mode`，支持 `solo_local` / `group_local`。
- 已完成：训练总结新增小组成员数据同步确认边界；确认和服务器同步仍作为后续云同步能力预留。
- 后续：把成员确认请求落到真实账号成员绑定、远程通知和云同步队列。

## 2026-06-28 profile-password-auth-avatar-sprint

- 历史摘要：本 Sprint 曾完成账号头像、头像压缩 / 缓存 service 和 SQLite v6 账号资料缓存 / 成员头像字段。
- 当前规则：我的页展示账号主卡、训练档案、小组成员、偏好设置、账号设置和关于练刻；退出登录已归入账号设置页。
- 保持不变：训练记录仍云端优先，本地 SQLite 作为缓存与离线副本。
## 2026-06-24 phone-code-auth-gate-sprint

- 已完成：登录门禁接入；当前最新规则见 2026-06-28 Sprint，登录为手机�?+ 密码，注册为手机�?+ 验证�?+ 密码 + 昵称�?- 已完成：根路由增加登录保护；�?session 首次启动进入 `/account/login`，不能进入主 Tab�?- 已完成：有本�?session 但服务器不可达时进入 `offline_authenticated`，允许进入默认主界面并显示本机模式提示�?- 已完成：验证码发送接入统一网络错误映射、请求超时、手机号格式校验、发�?loading �?60 秒倒计时�?- 已完成：新增 `AuthMode` / `MembershipTier` / `FeatureKey` / `decideFeatureAccess()`，集中管理未登录、免费版、Pro 和永久会员权限�?- 已完成：登录 required 弹层不再提供关闭后浏览；关键入口不再散写页面级权限规则�?- 已完成：登录成功直接进入�?App；当前不会删除、覆盖或自动上传 SQLite 数据�?- 保持不变：训练执行的 set 保存、完成训练和 Repository 仍然云端优先，本地 SQLite 作为缓存与离线副本，不新增联网前置条件�?- 后续：完整云同步队列、登录后本机数据绑定到账号、支付购买和在线同练仍待后续版本�?
## 2026-06-24 cloud-service-v1-sprint

- 已完成：新增 `apps/liftmark-api` 后端工程，使�?Fastify + TypeScript + PostgreSQL + Knex migration�?- 已完成：落地账号、短信验证码、JWT、会�?激活码、小组、同步、训练聚合、成就、公告、反馈和后台管理 API 第一版�?- 已完成：App 账号页接入真实密码登录、验证码注册、token 安全存储、启动恢复和退出登录；会员与激活页改为后端会员状态与云端激活码兑换�?- 已完成：设置页显示当前服务器连接状态；新增最�?API smoke 脚本覆盖 health、注册、登录、me �?refresh�?- 已完成：删除普通用户“我的”页中的训练数据、导出备份类主入口；激活页不再显示开发期本地测试码�?- 保持不变：本�?SQLite 训练闭环、训练执行和本地 Repository 公共接口未修改，训练现场不依赖网络�?- 风险/后续：App 本地 SQLite �?`/api/sync/push` 的自动队列映射尚未接入；HTTP 明文仅用于当前开发阶段，正式上线应切�?HTTPS�?
## 2026-06-24 profile-account-sync-boundary-sprint

- 已完成：我的页重做为账号与训练身份中心，顶部主卡不再展示云同步、会员、Pro、试用或待同步信息�?- 已完成：底部�?Tab 确认为首�?/ 计划 / 记录 / 我的；`members` �?`explore` 仍保留为隐藏路由或二级入口�?- 已完成：新增账号安全、训练身份、我的小组、训练偏好、训练数据、数据与隐私、云同步、会员与激活等二级页面，占位能力均有明确提示�?- 已完成：新增 auth 占位 service/store �?sync store/service 边界；未接真实登录和云同步，不改�?SQLite、本�?Repository 或训练执行链路�?- 后续：接入真实后端登录、云同步队列持久化、远程邀请、会员支付和权益同步�?
## 2026-06-15 plan-dashboard-exercise-library-custom-exercise-member-limit-weight-git-sprint

- 已完成：系统动作库修复历史中文编码污染并扩展�?100+ 个系统动作，覆盖胸、背、肩、腿、手臂、核心和热身/有氧�?
- 已完成：新增 `exercises.source` �?migration v5，支持系统动�?/ 用户自定义动作；统一动作选择器接入历史补录和创建计划�?
- 已完成：计划页重做为当前计划仪表盘，展示本周执行、本周安排、我的计划摘要、计划工具和系统方案�?
- 已完成：用户计划可以在“管理全部计划”弹层删除；系统方案、当前计划和最后一个用户计划不能删除，删除计划不删除训练记录�?
- 已完成：本地小组成员上限集中配置�?5 人，相关页面和校验共用配置�?
- 已完成：训练页建议重量支持按百分比或次数区间保守估算，缺�?1RM 和孤立动作给出明确提示�?
- 后续：完整计划编辑器、动作库独立页面、真实文件保�?分享、软删除和云同步仍延后�?

## 2026-06-15 ui-consistency-plan-entry-member-flow-sprint

- 已完成：新增统一 `AppModalSheet`，复制方案、导入计划、导出内容、切换计划等复杂流程不再使用粗糙系统 Alert�?
- 已完成：计划页右上角加号进入真实创建计划页；系统方案主列表只展示可复制模板，开发中方案收进摘要卡；计划详情入口改为只读摘要页�?
- 已完成：探索�?PPL 入口接入系统方案复制/设当前流程，推荐方案最�?3 个，计划工具收成小卡�?
- 已完成：训练页切换计划改为底部列�?+ 二次确认，只列出我的计划，切换后刷新今日训练�?
- 已完成：记录页日期下训练记录压缩为摘要卡，显示主要动作前 2 个和剩余数量；训练建议文案改为更自然的基础规则说明�?
- 已完成：新增成员保存后自动返回成员列表；达到本地成员上限时前置展示说明�?
- 已完成：导出计划/数据后明确提示当前版本暂未保存文件，并支持复制内容�?
- 后续：真实文件保�?系统分享、深层计划编辑器、动作替换弹层和完整云同步邀请能力仍延后�?

## 2026-06-14 设置 / 历史 / 计划切换清理 Sprint

- 已完成：设置页使�?LiftMark 品牌专属图；成员资料改为全成员摘要入口；加重单位改为全成员选择入口；移除周五策略入口和最近导�?JSON 预览�?
- 已完成：计划页和设置页导�?`.liftmark.json`，通过 DocumentPicker、计划文�?schema 校验、ID 重映射和 SQLite 落库生成“我的计划”�?
- 已完成：新增系统只读模板“经典三分化 PPL”，可通过“使用此方案”复制成用户计划�?
- 已完成：训练页当前计划卡新增“切换计划”，只列出用户计划，切换后刷新今日训练�?
- 已完成：记录页训练查询改为训练摘要卡并点击进入详情�?
- 已完成：`.gitignore` 补齐 node_modules、Expo 缓存、Android build 产物、APK/AAB/keystore 和环境变量忽略规则�?
- 后续：文件保�?分享/复制、计划深层编辑器、真实小组汇总、云同步和远程方案库仍延后�?

## 2026-06-14 训练执行交互修正 + UI 重设计补�?

- 训练执行页只保留重量、次数、完成/跳过和备注，不再展示旧强度快捷输入。
- 已完成：记录页按 `docs/ui/record-page-redesign.png` 改为紧凑数据页，强化当前成员个人口径、基础趋势、可点击日历和记录列表�?
- 已完成：设置页按 `docs/ui/settings-page-redesign.png` 改为移动设置中心，保留导出、计划管理、激活、诊断和调试保护入口�?
- 已完成：搭子页将完整本地小组规则收纳到二级弹层，主页面仅显示短说明�?
- 已完成：图标背景�?safe margin 修复，Expo splash 引用透明居中 `splash-logo.png`�?
- 后续：真实小组汇总、显式成员切换、设置页文件保存/分享、复杂训练趋势和更完整页面视觉回归�?

## 2026-06-14 训练执行体验与记录数据口径修�?

- 已完成：训练执行页完成本组后自动进入休息、下一组、下一个动作或训练总结�?
- 已完成：重量/次数直接输入，完成情况 可留空并按范围校验�?
- 已完成：当前动作已完成组可编辑、删除，并支持撤销上一组�?
- 已完成：补录训练支持休息时间留空，并写入训练动作记录快照�?
- 已完成：记录页默认只统计当前成员个人数据，并明确展示当前成员、我的本周训练量、我的本周训练次数、我的本周完成组数�?
- 已完成：小组汇总入口改为开发中说明，不混用个人统计�?
- 已完成：搭子页和设置页补充本地小组与未来云同步规则�?
- 后续：显式成员切换、小组汇总真实聚合、训练密度、复杂疲劳分析和高级图表�?
## 2026-06-14 品牌迁移完成�?

- 品牌迁移 Sprint：完成“练�?LiftMark”命名、图标资源、启动页、Android package、导出格式、设置页品牌卡和关于页�?
- 当前推荐验收命令仍为 `npm run android:preview`，打开包名 `com.liftmark.app`�?
- 后续 Sprint 继续从训练功能出发，不在�?Sprint 增加云同步、登录、计划市场或业务重构�?


更新时间�?026-06-12

## 1. 已完成功�?

| 功能 | 状�?| 相关模块 | 相关文档 | 完成时间 |
|---|---|---|---|---|
| 项目 docs 文档体系 | 已完�?| docs | `docs/` | 2026-06-08 |
| Sprint 1 项目骨架和数据库骨架 | 骨架已完�?| database, group, member, plan, workout, progression | `training-partner-app/`, `docs/database/schema.md`, `docs/api/local-repository-api.md` | 2026-06-09 |
| Sprint 2 成员管理 | 实现已完�?| member, group, weight | `app/(tabs)/members.tsx`, `app/member/*`, `src/components/members/`, `src/tests/member.test.ts` | 2026-06-09 |
| Sprint 3 默认计划和今日训�?| 实现已完�?| plan, exercise, weight, recovery | `src/data/seed/defaultExercises.ts`, `src/data/seed/defaultAlternatives.ts`, `src/data/seed/defaultStrengthPlan.ts`, `src/data/seed/defaultHypertrophyPlan.ts`, `src/data/seed/defaultDeloadPlan.ts`, `app/(tabs)/today.tsx`, `app/(tabs)/plan.tsx`, `src/tests/plan.test.ts`, `src/tests/weight.test.ts`, `src/tests/recovery.test.ts` | 2026-06-09 |
| Sprint 4 训练执行�?| 实现已完�?| workout, member, plan, exercise, weight | `app/workout/[sessionId].tsx`, `app/workout/summary/[sessionId].tsx`, `src/data/local/repositories/workoutRepository.ts`, `src/tests/workout.test.ts` | 2026-06-09 |
| 稳定性与基础体验 Sprint | 基础完成 | settings, export, plan, history, Android build | `app/(tabs)/settings.tsx`, `app/(tabs)/history.tsx`, `src/services/planFileService.ts`, `src/services/exportService.ts`, `src/domain/history/history-analysis.ts`, `package.json` | 2026-06-11 |
| UI 设计系统与核心页面重�?Sprint | 基础完成 | ui, plan, group, member, workout, history | `src/theme/*`, `src/components/ui/*`, `app/(tabs)/explore.tsx`, `app/(tabs)/members.tsx`, `app/(tabs)/today.tsx`, `app/(tabs)/plan.tsx`, `app/(tabs)/history.tsx`, `app/workout/*` | 2026-06-12 |
| 计划模块系统方案分离 Sprint | 基础完成 | plan, group, database, export | `src/domain/plan/systemSchemes.ts`, `src/domain/plan/planCopy.ts`, `src/data/local/migrations.ts`, `src/data/local/repositories/planRepository.ts`, `app/(tabs)/plan.tsx` | 2026-06-12 |

## 2. 开发中功能

| 功能 | 当前状�?| 阻塞�?| 下一�?|
|---|---|---|---|
| 业务 App | 计划模块系统方案分离 Sprint 验证�?| 完整业务持久化场景仍需手工烟测 | 进入 Sprint 5 动作替换和训练完成增强，并保�?APK 安装后的业务回归检�?|
| Android 本地预览 APK | 已完�?| `npm run android:preview` 可编译、安装并打开 `com.liftmark.app` | �?`npm run android:preview` 作为当前主要验收方式；清理优先用 `npm run android:clean:native`，development build 仅作为后续调试选项 |
| 可用�?+ UI 落地 Sprint | 基础完成，本地图片资产已接入 | 需�?Android 设备继续做完整人工路径烟�?| 回归训练页周五覆盖、记录日历、补录、历史编辑、创建计划、激活码、设置页和图�?Hero 显示 |

## 3. 待开发功�?

| 功能 | 优先�?| 预计模块 | 备注 |
|---|---|---|---|
| Sprint 5：动作替换和训练完成 | P0 | exercise, workout | 替换弹层、替换保存、总结 |
| Sprint 6：进阶建议和历史增强 | P1 | progression, history | progression engine、历史详情、动作筛选和更完整趋�?|
| Sprint 7：设置和导出增强 | P1 | settings, export | 文件保存/分享、计划导入落库、备份恢�?|
| Sprint 8：计划创建与编辑器基础 | P1 | plan, exercise, export | 创建计划向导、训练日编辑、动作模板和 `.liftmark.json` 导入落库 |

## 4. 延后功能

| 功能 | 延后原因 | 恢复条件 |
|---|---|---|
| 账号登录 | MVP 云端优先 + 本地缓存 | 阶段 3 云同�?|
| 云同�?| 先保证离线训练闭�?| Repository 和本地数据稳�?|
| 二维码加�?| 依赖账号和云端小�?| 阶段 3 |
| 计划编辑�?| MVP 先做默认计划执行 | 默认计划执行闭环稳定 |
| 计划市场 | 商业版能�?| 有账号、分享、审核和支付 |
| 教练模式 | 依赖云端小组和权�?| 阶段 5 |
| 动作视频 | �?MVP 核心 | 动作库稳定并有素�?|
| 复杂数据分析 | MVP �?| 历史数据足够 |

## 5. 技术�?

| 技术�?| 影响 | 优先�?| 建议处理 |
|---|---|---|---|
| SQLite migration 版本策略需持续执行 | 后续表结构变更风�?| P0 | 已采�?`schema_migrations`，后续只追加 migration |
| roundToIncrement 边界策略未确�?| 建议重量可能有争�?| P0 | �?weight 测试中固定策�?|
| 完整 seed 数据需要后续维护策�?| Excel 模板变化后已有本地数据是否迁移需确认 | P1 | 后续新增 seed 版本和重置策�?|
| 删除/清空策略未确�?| 历史记录误删风险 | P1 | 设计软删除或确认二次确认策略 |
| Android build 环境约束 | Gradle/JDK toolchain 已固定到 `JAVA_HOME` JDK 17；本地预�?APK 使用 `com.liftmark.app` | P0 | 保持 Node.js 22.13.0+ �?JDK 17；遇到项目内 native/CMake 缓存异常先运�?`npm run android:apk:clean` |
| Gradle clean �?node_modules CMake 缓存 | 原生 `gradlew clean` 在构建后可能清理�?`node_modules/react-native-reanimated/android/.cxx` 并失败；当前约束是不修改 `node_modules` | P1 | 不把 raw `gradlew clean` 作为本阶�?APK 验收步骤；如需深度清理 `node_modules` 生成缓存，需单独确认策略 |
| Android 全架�?release 构建 | `x86_64` 预览 APK 已通过；全架构构建曾在 `react-native-reanimated` �?`armeabi-v7a` CMake 阶段出现 dirty manifest | P1 | 当前模拟器验收优先用 `npm run android:apk`；真机预览用 `npm run android:apk:device`；正式发版前再处理全架构产物 |

## 6. 重构计划

当前已有 Sprint 1 项目骨架和本地数据层骨架，暂无需要重构的业务实现。后续应避免先堆 UI 再抽 Domain�?

## 7. 风险事项

- 如果先做 UI，容易把计划写死在组件中�?
- 如果先做单人逻辑，后续多人改造成本高�?
- 如果训练记录不用 SQLite，即�?MVP 能跑也无法可靠用于训练现场�?
- 如果不先定义 schema �?Repository，后续云同步边界会混乱�?

## 8. 版本计划

### Sprint 1：项目骨架和数据�?

状态：骨架已完成，Android 本地预览 APK 流程已补齐；TypeScript、lint、项目内 native clean、x86_64 release APK 构建、APK 安装和首屏启动均已在 Node.js v24.16.0 / Microsoft JDK 17.0.19 下通过。原�?`gradlew clean` 在构建后仍可能受 `node_modules` CMake 生成缓存影响，本阶段不作�?APK 验收步骤�?

任务�?

- 创建 Expo 项目�?
- 配置 Expo Router�?
- 配置 TypeScript�?
- 配置 ESLint / Prettier�?
- 创建主题系统�?
- 创建 SQLite 初始化�?
- 创建 migrations�?
- 创建基础 Repository�?
- 创建 `seedDefaultData`�?

验收�?

- App 可在 Android 启动：已通过本地 release APK 在模拟器打开首屏；真机仍需人工验证�?
- 首次启动自动创建默认数据：已创建 `initializeLocalDatabase` + `seedDefaultData` 入口�?
- SQLite 表创建成功：已通过 schema/migrations 代码和类型检查，并通过 APK 首屏启动烟测验证初始化不崩溃�?
- 可以读取默认 group 和默�?plan：已创建 SQLite Repository 骨架和默�?group/plan shell seed�?

### Sprint 2：成员管�?

状态：实现已完成，本地 APK 首屏已通过；成员新�?编辑后关闭重开 App 的持久化烟测待手工验证�?

验收�?

- 可以创建 2-5 个成员：已实现成员列表、新增成员和最�?5 人限制�?
- 每个成员可以保存不同 1RM：已实现体重、四大项 1RM、引体参考重量、杠�?哑铃加重单位表单�?
- 关闭 App 后数据仍存在：已通过 SQLite Repository 写入；仍�?Android 真机关闭重开烟测�?

### Sprint 3：默认计划和今日训练

状态：实现已完成，本地 APK 首屏已能读取默认计划并展�?Today；完整计划切换和成员建议重量烟测待手工验证�?

验收�?

- 今日训练页能显示正确训练内容：已�?SQLite seed 读取 `PlanDay` / `PlanExercise` / `Exercise`�?
- 不同成员显示不同建议重量：已按成�?1RM、器械类型和加重单位计算�?
- 状态一般隐�?C 动作：已实现 recoveryMode `normal` 过滤�?
- 状态差只显�?A 动作：已实现 recoveryMode `bad` 过滤�?
- 周五默认休息：默认小�?`friday_enabled=0`，Plan 页可开启�?

### Sprint 4：训练执行页

状态：实现已完成，本地 APK 已可启动�?Today；完整训练执行、退出重进和完成总结烟测待手工验证�?

验收�?

- 可以完成一场多人训练：已支持从今日训练创建 session、records、sets 并进入执行页�?
- 中途退出后重新进入不丢数据：执行页�?SQLite 读取 session detail，同一天未完成 session 会复用�?
- 每个成员的实际重量、次数、完成情况 独立保存：每个成员每组对应独�?`workout_sets` 行，`saveSet` 即时保存�?
- 默认按动作轮换：训练页按动作导航，当前动作下展示成员 set 卡�?
- 训练执行页不�?Excel 表格：使用卡片和大按�?stepper�?

### Sprint 5：动作替换和训练完成

验收�?

- 器械被占时可以替换动作�?
- 历史记录保留 `replaced_from_exercise_id`�?
- 完成训练后进入总结页�?

### Sprint 6：进阶建议和历史

验收�?

- 增力期可生成加重/维持/降重/减量建议�?
- 增肌期可生成加重/继续加次�?维持或降重建议�?
- 记录页可以查看近期训练�?

### Sprint 7：设置和导出

验收�?

- 用户可以导出本地训练数据：基础 JSON 字符串已实现，文件保�?分享待增强�?
- 可以重置 seed 数据：已实现重置默认计划入口，且不删除训练记录�?
- App 无数据时有合理空状态：设置和历史页已具备基础空状态�?
- 可以导出当前计划�?`.liftmark`：service 和设置页入口已实现�?
- 可以导入计划：service 已支�?schema 校验和新 ID 重映射，文件选择和落库待增强�?

## 9. 下一步建�?

下一步建议进�?Sprint 5：动作替换和训练完成增强。开发验收优先使用本地预�?APK：`npm run android:preview`。并行补五项设备验收：首次启动数据库 seed 烟测、成员新�?编辑后关闭重开 App 的持久化烟测、今日训练页读取当前用户计划烟测、训练执行页中途退出再进入烟测、五个主 Tab 在小屏和大屏模拟器上的视觉回归检查�?

