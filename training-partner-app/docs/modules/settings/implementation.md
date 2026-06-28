# Settings 模块实现文档

更新时间�?026-06-24  
对应代码目录：`training-partner-app/`

## 2026-06-24 登录接入实现补充

| 文件 | 说明 |
|---|---|
| `app/account/login.tsx` | 密码登录 + 验证码注册页；登录成功后直接进入�?App�?|
| `app/_layout.tsx`、`app/index.tsx` | 启动门禁：无 session 进入登录页，�?session 离线进入本机模式�?|
| `src/domain/auth/*` | 未登录、免费版、Pro、永久会员的权限与退出策略集中定义�?|
| `src/components/auth/*` | 登录要求、Pro 要求、云同步提示�?gate sheets；登录要求弹窗不再提供关闭后浏览�?|
| `src/hooks/useAuthGate.ts` | 页面统一调用 `guardFeature()`，不在页面散写权限判断�?|
| `src/services/httpClient.ts`、`src/services/apiClient.ts` | API base URL、超时、JSON 解析和网络错误中文映射�?|
| `src/store/authStore.ts` | 保存 `authStatus`、当前用户、会员状态和 token 恢复动作�?|

实现边界：本次不修改 SQLite schema，不修改 Repository 公共接口，不把训练记录迁移到 AsyncStorage，不让训练执行依赖网络�?
## 2026-06-24 实现更新

| 文件 | 说明 |
|---|---|
| `app/(tabs)/settings.tsx` | 重做为我的页，组织账号主卡（HeroCard 小组/计划可点击跳转）、训练档案、小组成员、偏好设置、账号设置、关于练刻和退出登录�?|
| `app/profile/avatar.tsx` | 账号头像设置页，点击头像直接打开相册选择并上传服务器�?|
| `src/components/profile/*` | 我的页专�?Hero、Section、MenuItem �?Logout 组件�?|
| `src/components/avatar/*` | 通用头像与可编辑头像组件�?|
| `app/account/*` | 账号资料、登�?/ 注册占位、账号安全二级页�?|
| `app/profile/*` | 训练身份、小组、偏好、数据、隐私、云同步、会员与激活二级页�?|
| `src/services/auth/*`、`src/store/authStore.ts` | 真实认证服务边界，接后端密码登录、验证码注册、token 保存/刷新和会员等级派生�?|
| `src/services/avatar/*` | 账号头像选择、压缩、格式校验、本地缓存和服务器上传边界�?|
| `src/sync/syncService.ts`、`src/store/syncStore.ts` | 云同步占位边界，继续遵守数据安全优先�?|

旧设置页中的试用模式、清空测试数据、重置默认计划和 SQLite/seed 常驻诊断不再出现在普通我的页；开发者诊断隐藏到“关于练刻、意见反馈、用户协议、隐私政策和版本号。�?
头像实现边界：账号头像通过 `expo-image-picker` 选择或拍照，通过 `expo-image-manipulator` 裁剪�?1:1 并压缩为 JPEG。原图上�?10MB，最长边处理�?1024，目标小�?1MB，服务端硬限�?2MB；支�?jpg/jpeg/png/webp，HEIC/HEIF 尝试�?JPEG。SQLite 只保�?URL、缩略图 URL、本地缓存路径和更新时间，不保存二进制或 Base64�?
## 1. 主要文件

| 文件 | 说明 |
|---|---|
| `app/(tabs)/settings.tsx` | 设置页，展示顶部状态卡、分组设置列表、数据管理、计划管理、激活和开发调试信息�?|
| `app/settings/members.tsx` | 从设置页进入的全成员摘要列表，点击成员后再进�?`app/member/[memberId].tsx`�?|
| `app/settings/member-units.tsx` | 从设置页进入的全成员加重单位摘要列表，点击成员后再进入对应成员编辑页�?|
| `src/services/exportService.ts` | `exportLocalDataJson()`、`exportWorkoutDataJson()`、`resetDefaultPlanData()`�?|
| `src/services/planFileService.ts` | `.liftmark.json` 计划文件 service�?|
| `src/services/planDocumentService.ts` | 通过 Expo DocumentPicker 选择 `.liftmark.json`，读取文件并调用计划文件 service 校验�?ID 重映射�?|
| `app/activation.tsx` | 本地激活码页面�?|
| `src/services/activationService.ts` | 本地激�?service 工厂�?|

## 2. 核心函数

### settings members / member units

文件：`app/settings/members.tsx`、`app/settings/member-units.tsx`  
职责：设置页只提供成员资料和加重单位入口；两个页面展示所有成员摘要，用户点击某个成员后才进入成员编辑页�? 
边界：设置页不能内嵌 `MemberForm`，不能自动跳转第一个成员，不能把成员个人参数伪装成全局设置�?

### ActivationService.activate()

文件：`src/domain/activation/activation.service.ts`  
职责：旧本地激活兼容服务；普通用户入口已迁移到“会员与激�?/ 激活码兑换”，以后端会员权益为准�? 
调用方：`app/activation.tsx`、`app/(tabs)/settings.tsx`�?

### exportLocalDataJson()

文件：`src/services/exportService.ts`  
职责：导�?groups、member_profiles、plan、exercise、workout、progression、recovery �?SQLite 表数据为 JSON 字符串�? 
调用方：`app/(tabs)/settings.tsx`  
测试：后续可�?SQLite 集成测试�?

### createCurrentPlanFile()

文件：`src/services/planFileService.ts`  
职责：读取当前用户计划模板、阶段、训练日、计划动作、动作库和替代动作，生成 `.liftmark.json` JSON payload�? 
调用方：`app/(tabs)/settings.tsx`  
测试：`src/tests/plan-file.test.ts`

### createImportedPlanDraft()

文件：`src/services/planFileService.ts`  
职责：校�?`.liftmark.json` / `.liftmark` payload，并生成新的本地 plan/phase/day/exercise id，避免覆盖已有计划�? 
调用方：`src/services/planDocumentService.ts`、`app/(tabs)/settings.tsx`、`app/(tabs)/plan.tsx`�? 
测试：`src/tests/plan-file.test.ts`

### PlanRepository.importUserPlan()

文件：`src/data/local/repositories/planRepository.ts`  
职责：将导入草稿写入 SQLite，生�?`source: "imported"`、`visibility: "private"` 的用户计划，并写入相�?phases、days、plan_exercises、exercises、alternatives�? 
调用方：设置页和计划页导入入口�? 
边界：不导入成员 1RM、身体数据、训练记录；不覆盖已有计划；不修改系统方案�?

## 3. 当前限制

- 设置页已改为移动设置中心：顶�?LiftMark 品牌�?状态卡、分组列表项、开发中标签、危险操作二次确认�?
- 本地小组规则通过列表入口弹窗展示，主页面只保留简洁状态�?
- 设置页不再展示成员编辑表单，不再显示“保存成员”或“稍后补充”�?
- 设置页不再暴露“周五策略”；`groups.friday_strategy` 字段保留给训练页兼容�?
- 设置页不再常驻展示导�?JSON 预览，文件保�?分享能力后续接入�?
- 导入计划入口已接入系统文件选择器、schema 校验、ID 重映射和 SQLite 落库；备份数据库、恢复数据库等入口仍显示“开发中”�?
- 清空测试数据、清空训练记录、重置整�?App 只保留二次确认和提示，避免误删真实训练记录�?

