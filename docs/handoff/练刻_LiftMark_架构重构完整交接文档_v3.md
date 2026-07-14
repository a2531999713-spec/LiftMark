# ===== 00_README.md =====


# 练刻 LiftMark 架构重构交接文档 v3

> 文件编码：UTF-8 with BOM  
> 文件名已改为英文，避免 Windows 解压后中文文件名乱码。  
> 本文档用于新开窗口交接给 Codex / GLM / 其他 AI 开发工具。

## 2026-07-11 P1 实施结果补充

计划周期统计、训练报告详情和按周期历史筛选已经在既有 P0 架构上实现。实际入口、统计口径、状态机、同步边界、36 个测试套件结果和未完成的 188/176 真机账号验收，统一以 `docs/03-architecture/plan-cycle-report-history-implementation-2026-07.md` 为当前 canonical 记录。本文后续保留的 P1 任务列表是重构时规划快照，不再代表当前未实现状态。

## 当前目标

本次不要继续围绕旧 Bug 打补丁，而是正式进行核心架构重构。

重构主线：

```text
账号作用域 → 小组 → 计划 → 计划周期 → 训练执行 → 训练报告 → 同步
```

动作库媒体资源暂不接入。  
健身动作 GIF / 第三方图片先全部取消实际接入，只保留接口、字段和扩展能力。

## 本次要解决的问题

1. 账号切换后数据不能串号。
2. 188 测试账号旧数据可以清空，不再抢救。
3. 176 主号服务器数据要保护，不能误删。
4. 首页、计划页、历史页、小组页必须有稳定空状态。
5. 计划必须支持周期、完成、归档和统计。
6. 训练提醒能做的先做，本地通知优先，服务端推送预留。
7. 每次训练结束生成训练报告。
8. 热量消耗做估算值，不做精确值。
9. 动作图片/GIF 不接入，但动作图标系统和媒体字段预留。
10. 后续动作图标采用“肌群 + 动作类型”的统一图标系统，而不是每个动作单独配 GIF。

## 文件说明

```text
00_README.md
01_current_status.md
02_core_architecture.md
03_plan_cycle_archive.md
04_reminder_notification.md
05_training_report_calorie.md
06_exercise_catalog_icon.md
07_codex_execution_task.md
08_validation_checklist.md
09_github_sync.md
10_first_message_for_new_window.md
LiftMark_refactor_handoff_full_v3.md
```

## 是否需要同步到 GitHub？

需要。

建议同步这些文档到仓库：

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
```

不要同步：

```text
.env
.pem
数据库备份
服务器密钥
阿里云密钥
临时截图
历史调试日志
zip 包
```


# ===== 01_current_status.md =====


# 01 当前状态与重构决策

## 一、项目背景

项目名称：练刻 LiftMark  
定位：多人力量训练 App  
技术方向：Expo / React Native，Android 优先，iOS 预留  
后端：Node / PostgreSQL / PM2 / Nginx  
服务器：47.100.239.29  

## 二、当前问题

之前修复过账号隔离、云端恢复、计划页空状态等问题，但实际 App 仍然存在较多主链路问题：

```text
1. 首页仍可能显示“近日计划未就绪”。
2. 云端恢复提示成功，但本地可见数据不完整。
3. 计划、训练、补录、小组、同步之间状态复杂。
4. 188 测试账号曾经看到 176 数据。
5. 本地 SQLite 曾经历未隔离、误认领、重新拉取、多账号切换，已经不可信。
6. 继续零散修 Bug 容易反复。
```

## 三、账号现状

### 176 主号

```text
user_id = usr_35c96ce5f49045448bae4ec1dd5340a6
nickname = 练刻管理员
服务器训练数据完整
必须保护
不要删除
不要迁移给其他账号
```

### 188 测试号

```text
user_id = usr_90fe5d00deaf431c8a15e140b056ff8e
nickname = 练刻用户3716
测试数据可以删除
可以清空
可以重建
不需要兼容旧污染数据
```

## 四、本次重构决策

本次不再以“修复旧本地污染数据”为目标。

新的验证基准：

```text
fresh install / 清空 App 数据后：
1. 账号作用域稳定。
2. 新账号空状态稳定。
3. 小组、计划、训练、报告、同步主链路稳定。
4. 旧测试账号数据可以重建。
```

## 五、功能范围

本次要加入架构的功能：

```text
1. 计划周期、完成、归档和统计。
2. 训练提醒和通知。
3. 训练结束报告。
4. 热量消耗估算。
5. 动作库接口预留。
6. 肌群 / 动作类型图标系统。
7. 身体部位热力图数据预留。
```

实际接入取消：

```text
1. 不接入第三方动作 GIF。
2. 不接入第三方动作图片。
3. 不把开源媒体资源打包进 APK。
4. 不在本阶段做真实动作媒体下载。
```


# ===== 02_core_architecture.md =====


# 02 核心数据架构与账号作用域

## 一、重构目标

建立清晰的数据主链路：

```text
Account
  ↓
AccountScope
  ↓
Group
  ↓
GroupMember / MemberProfile
  ↓
TrainingPlan
  ↓
PlanCycle
  ↓
PlanDay / PlanExercise
  ↓
WorkoutSession
  ↓
WorkoutExerciseRecord
  ↓
WorkoutSet
  ↓
TrainingReport
  ↓
SyncQueue
```

## 二、核心原则

所有核心数据必须有明确归属：

```text
owner_user_id
group_id
plan_id
plan_cycle_id
plan_day_id
plan_exercise_id
exercise_id
recorded_by_user_id
source_device_id
sync_status
```

页面不允许绕过 repository 直接查询全局数据。

## 三、账号作用域

必须统一封装：

```ts
getRequiredCurrentUserId()
getCurrentAccountScope()
getCurrentGroupScope()
assertOwnerUser(entity, currentUserId)
assertGroupBelongsToUser(groupId, currentUserId)
```

## 四、切换账号规则

切换账号时必须清理或刷新：

```text
selectedGroupId
activePlanId
currentMemberId
nickname cache
avatar cache
local sync queue context
today page cache
plan page cache
history query state
```

## 五、Repository 规则

所有 repository 查询必须带 currentUserId：

```text
groupsRepository.listByUser(currentUserId)
plansRepository.listByUserAndGroup(currentUserId, groupId)
workoutRepository.listSessions(currentUserId, groupId)
reportRepository.listReports(currentUserId, groupId)
```

禁止：

```text
SELECT * FROM workout_sessions
SELECT * FROM training_plans
SELECT * FROM groups
```

必须：

```text
WHERE owner_user_id = ?
WHERE group_id IN 当前账号可见 group
```

## 六、同步规则

同步分两种：

```text
syncIncremental：普通增量同步
restoreFromCloud：强制全量恢复
```

restoreFromCloud 不依赖 last_pulled_at，不使用 since 过滤。

## 七、空状态规则

必须处理以下状态：

```text
noAccount
noGroup
noMember
noActivePlan
planCompleted
planArchived
noTodayWorkout
hasHistoryNoPlan
error
loading
```

188 测试号没有小组是正常状态，不能白屏，不能默认加入 176 的 group。


# ===== 03_plan_cycle_archive.md =====


# 03 计划周期、归档与统计设计

## 一、为什么必须做

力量训练计划通常有明确周期，比如：

```text
4 周增肌计划
8 周力量提升计划
12 周周期训练
```

计划执行完后不能只留普通训练历史，应该生成一个“已完成计划周期”和周期统计。

## 二、计划状态

TrainingPlan 建议增加状态：

```text
draft
active
paused
completed
archived
abandoned
```

含义：

```text
draft：草稿，未开始
active：当前执行中
paused：暂停
completed：已完成，但还未归档
archived：已归档
abandoned：中途放弃
```

## 三、计划周期表

新增或预留：

```text
plan_cycles
```

字段建议：

```text
id
owner_user_id
group_id
plan_id
cycle_index
name
start_date
end_date
planned_weeks
actual_start_date
actual_end_date
status
completed_at
archived_at
created_at
updated_at
```

## 四、计划周期统计表

新增或预留：

```text
plan_cycle_summaries
```

字段建议：

```text
id
owner_user_id
group_id
plan_id
plan_cycle_id
planned_workout_count
completed_workout_count
skipped_workout_count
completion_rate
total_volume
total_sets
total_reps
total_duration_seconds
estimated_calories
top_progress_exercises_json
weak_exercises_json
muscle_group_distribution_json
summary_text
created_at
updated_at
```

## 五、周期结束逻辑

当计划达到周期末尾时，App 应提示：

```text
当前计划周期已完成
是否归档并查看周期总结？
```

用户可选择：

```text
1. 归档计划周期。
2. 复制为下一周期。
3. 调整后继续执行。
4. 暂不处理。
```

## 六、第一版必须做

```text
1. plan status 字段。
2. plan cycle 字段或表结构。
3. 计划完成后的归档入口。
4. 基础统计：训练次数、完成率、总训练量、总组数、总时长。
5. 训练历史能按计划周期筛选。
```

## 七、后期再做

```text
1. AI 周期总结。
2. 自动生成下周期建议。
3. 动作进步趋势。
4. 肌群训练偏差分析。
5. 与会员权益关联。
```


# ===== 04_reminder_notification.md =====


# 04 训练提醒与通知设计

## 一、功能判断

训练提醒应该进入架构。  
第一版优先做本地通知，服务端推送先预留。

## 二、提醒类型

建议支持：

```text
fixed_time：固定时间提醒
before_workout：训练前提醒
today_plan：当天计划提醒
missed_workout：未训练提醒
cycle_review：周期总结提醒
```

## 三、第一版本地通知

第一版可以做：

```text
1. 用户设置每周训练时间。
2. 提前 30 分钟提醒。
3. 提前 10 分钟提醒。
4. 当天提醒今日计划。
5. 通知点击后打开今日页或训练页。
```

通知示例：

```text
还有 30 分钟开始训练
今日计划：胸 + 三头
准备好训练装备，按计划开始。
```

## 四、数据表设计

新增或预留：

```text
training_reminders
```

字段建议：

```text
id
owner_user_id
group_id
plan_id
plan_cycle_id
type
enabled
weekday
remind_time
minutes_before
timezone
title_template
body_template
last_scheduled_at
last_fired_at
created_at
updated_at
```

## 五、服务端推送预留

后期如做服务端推送，预留：

```text
push_devices
push_tokens
notification_jobs
notification_logs
```

字段方向：

```text
device_id
owner_user_id
platform
push_token
enabled
last_seen_at
```

## 六、第一版要做

```text
1. 本地通知权限申请。
2. 训练前 30 分钟提醒。
3. 训练前 10 分钟提醒。
4. 按计划日生成提醒。
5. 设置页提供提醒开关。
```

## 七、暂时预留

```text
1. 服务端推送。
2. 跨设备提醒。
3. 小组成员互相提醒。
4. 会员专属智能提醒。
```


# ===== 05_training_report_calorie.md =====


# 05 训练报告与热量估算设计

## 一、训练结束必须生成报告

每次训练结束后都应该生成训练报告，而不是只保存原始记录。

训练报告用于：

```text
1. 用户训练反馈。
2. 历史记录展示。
3. 计划周期统计。
4. 数据分析。
5. 后续 AI 总结。
```

## 二、训练报告内容

第一版报告包含：

```text
训练日期
训练计划名称
训练部位
训练时长
总训练量
完成动作数
完成组数
总次数
估算热量
主要动作表现
个人备注
```

## 三、训练报告表

新增或预留：

```text
training_reports
```

字段建议：

```text
id
owner_user_id
group_id
member_id
plan_id
plan_cycle_id
workout_session_id
report_date
duration_seconds
total_volume
total_sets
total_reps
exercise_count
estimated_calories
intensity_level
muscle_group_summary_json
exercise_summary_json
personal_records_json
notes
created_at
updated_at
sync_status
```

## 四、热量估算

可以做，但必须标明是估算值。

不要显示：

```text
精确消耗 237 kcal
```

应该显示：

```text
预计消耗 180–260 kcal
```

## 五、估算算法

第一版使用 MET 公式：

```text
热量 kcal = MET × 体重 kg × 训练时长 h
```

力量训练 MET 建议：

```text
轻度：3.5
中等：5.0
高强度：6.0
```

如果用户没有体重：

```text
使用默认体重 65 kg
并在 UI 上标注：完善体重后估算更准确
```

## 六、训练强度判断

可用以下因素估算：

```text
训练时长
总组数
总训练量
平均组间休息
是否接近力竭
动作类型
```

第一版可以简单分：

```text
low
medium
high
```

## 七、第一版要做

```text
1. 训练结束自动生成 report。
2. 历史详情页显示 report。
3. 显示估算热量范围。
4. 计划周期统计读取 report。
```

## 八、后期再做

```text
1. 接入心率设备。
2. 更准确热量算法。
3. AI 训练总结。
4. 恢复建议。
5. 训练疲劳评估。
```


# ===== 06_exercise_catalog_icon.md =====


# 06 动作库与动作图标接口预留

## 一、当前决策

本阶段不接入第三方动作 GIF、图片或视频资源。

原因：

```text
1. 授权干净的图片视觉质量不符合练刻定位。
2. 视觉好的 GIF/图片通常存在媒体授权限制。
3. 本次重构重点是主架构稳定。
4. 动作媒体后续单独立项。
```

## 二、保留动作库接口

保留数据结构：

```text
exercises
exercise_categories
exercise_muscles
exercise_equipment
exercise_media
exercise_aliases
exercise_import_sources
```

动作字段建议：

```text
id
source
source_id
name_zh
name_en
aliases
primary_muscle
secondary_muscles
equipment
movement_pattern
force_type
difficulty
is_unilateral
is_bodyweight
default_unit
instructions_zh
instructions_en
tips
thumbnail_url
gif_url
video_url
local_asset_path
media_source
media_license
media_attribution
media_usage_status
icon_key
heatmap_key
is_system
is_custom
created_by_user_id
created_at
updated_at
```

## 三、动作图标策略

不要每个动作都单独生成图标。  
采用：

```text
肌群 + 动作类型
```

自动匹配图标。

## 四、肌群图标

第一层：

```text
胸
背
肩
腿
臀
二头
三头
核心
小臂
小腿
全身
有氧
```

第二层：

```text
上胸
中胸
下胸
背阔肌
上背
下背
肩前束
肩中束
肩后束
股四头
腘绳肌
臀大肌
腹直肌
腹斜肌
```

## 五、动作类型图标

```text
推
拉
蹲
髋铰链
划船
举过头
弯举
伸展
飞鸟
外展
内收
核心抗伸展
核心抗旋转
```

## 六、图标匹配示例

```text
卧推 → 胸 + 推
上斜卧推 → 上胸 + 推
侧平举 → 肩中束 + 外展
俯身飞鸟 → 肩后束 + 飞鸟
高位下拉 → 背阔肌 + 拉
杠铃划船 → 上背 + 划船
深蹲 → 股四头/臀 + 蹲
罗马尼亚硬拉 → 腘绳肌/臀 + 髋铰链
腿屈伸 → 股四头 + 伸展
弯举 → 二头 + 弯举
臂屈伸 → 三头 + 伸展
```

## 七、热力图策略

动作列表使用图标。  
训练报告和周期总结使用身体热力图。

预留字段：

```text
heatmap_key
muscle_activation_json
```

## 八、第一版要做

```text
1. exercise_id 稳定进入计划和训练记录。
2. icon_key 字段。
3. movement_pattern 字段。
4. primary_muscle / secondary_muscles 字段。
5. 动作选择页 / 替换动作页结构预留。
6. 默认仍可使用小哑铃图标。
```

## 九、后期再做

```text
1. 30–50 个统一风格 SVG 图标。
2. GPT 辅助生成统一风格图标。
3. 肌群热力图。
4. 动作详情图示。
5. 商业授权动作媒体。
```


# ===== 07_codex_execution_task.md =====


# 07 Codex 执行任务说明

## 一、任务方向

本次不要继续零散修 Bug。  
正式进入核心架构重构。

重构目标：

```text
账号作用域
小组
计划
计划周期
训练执行
训练报告
同步
提醒
动作接口预留
```

## 二、开始前

先执行：

```bash
git status
git log --oneline -8
git branch --show-current
```

创建分支：

```bash
git checkout -b refactor/core-scope-plan-report-reminder
```

不要使用：

```bash
git add .
```

## 三、必须先阅读的文档

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
README.md
```

如果文档路径不同，请先搜索最新架构交接文档。

## 四、P0 任务

```text
1. 重构账号作用域。
2. 重构小组空状态。
3. 重构计划状态。
4. 增加计划周期和归档结构。
5. 重构训练开始、保存、结束主链路。
6. 训练结束生成训练报告。
7. 增加热量估算字段和基础算法。
8. 增加训练提醒本地通知。
9. 动作库只预留接口，不接入媒体资源。
10. 修复同步队列 owner scope。
```

## 五、P1 任务

```text
1. 计划周期统计。
2. 历史记录按计划周期筛选。
3. 训练报告详情页。
4. 训练提醒设置页。
5. 动作图标 icon_key 映射。
```

## 六、暂时只预留

```text
1. 服务端推送。
2. 动作 GIF。
3. 第三方动作图片。
4. AI 训练总结。
5. 完整身体热力图。
6. 商业动作媒体授权接入。
```

## 七、保护规则

禁止：

```text
1. 删除 176 主号服务器训练数据。
2. 迁移 176 数据给 188。
3. 迁移 188 数据给 176。
4. 无备份执行破坏性 SQL。
5. 提交密钥、.env、.pem、数据库备份。
6. 提交临时截图、zip 包、调试日志。
```

188 测试数据可以清空或重建。

## 八、验证命令

移动端：

```bash
cd training-partner-app
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
```

后端如果修改：

```bash
cd apps/liftmark-api
npm install
npm run typecheck
npm run build
```

## 九、Android 验证

必须验证：

```text
1. 清空 App 数据。
2. 登录 176。
3. 首页不错误显示“近日计划未就绪”。
4. 历史可见。
5. 计划页可用。
6. 登出。
7. 登录 188。
8. 188 不显示 176 数据。
9. 188 空状态不白屏。
10. 188 可创建小组。
11. 188 可使用计划。
12. 188 可开始训练。
13. 训练结束生成报告。
14. 训练报告显示估算热量。
15. 本地训练提醒可设置。
```

## 十、提交信息

建议：

```bash
git commit -m "refactor: stabilize account scoped training architecture"
```

如拆分提交：

```text
refactor: unify account and group scope
feat: add plan cycle archive model
feat: add training report and calorie estimate
feat: add local workout reminders
chore: reserve exercise catalog icon fields
```


# ===== 08_validation_checklist.md =====


# 08 验证与验收清单

## 一、账号验证

### 176 主号

```text
登录成功
昵称正确
不显示 188 数据
历史记录可见
计划页可用
首页状态正确
```

### 188 测试号

```text
登录成功
不显示 176 数据
无小组时不白屏
可创建小组
可创建成员 profile
可使用系统计划
可开始训练
训练记录只归属 188
```

## 二、小组验证

```text
无小组空状态
创建小组
切换小组
小组成员加载
当前成员选择
不会跨账号读取 group
```

## 三、计划验证

```text
计划 draft
计划 active
计划 paused
计划 completed
计划 archived
计划 abandoned
计划周期 start_date / end_date
计划周期完成后可归档
```

## 四、训练验证

```text
从计划开始训练
临时训练
补录训练
保存组
切换成员
结束训练
历史可见
计划绑定正确
训练报告生成
```

## 五、训练报告验证

```text
训练时长
总训练量
总组数
总次数
动作数量
估算热量
训练强度
肌群统计预留
```

## 六、提醒验证

```text
提醒开关
训练前 30 分钟提醒
训练前 10 分钟提醒
点击通知进入今日页
权限拒绝时有提示
```

## 七、动作接口验证

```text
exercise_id 可用于 plan_exercise
exercise_id 可用于 workout record
icon_key 字段存在
primary_muscle 字段存在
movement_pattern 字段存在
不接入第三方媒体
不提交 GIF / 图片资源
```

## 八、同步验证

```text
同步队列带 owner_user_id
切换账号后不上传上个账号数据
restoreFromCloud 不依赖 since
普通 sync 不破坏本地作用域
```

## 九、测试命令

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

后端如修改：

```bash
npm run typecheck
npm run build
curl -i http://47.100.239.29/api/health
```


# ===== 09_github_sync.md =====


# 09 GitHub 文档同步建议

## 一、需要同步到 GitHub

建议同步：

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
README.md
```

原因：

```text
1. 新窗口 Codex 需要读取最新架构。
2. 避免 Codex 只基于旧代码继续补 Bug。
3. 让后续每次开发都有明确依据。
4. 保留架构决策记录。
```

## 二、不要同步

```text
.env
.pem
数据库密码
服务器密钥
阿里云密钥
数据库备份
临时截图
调试日志
zip 包
未整理聊天记录
```

## 三、推荐命令

```bash
git status
git checkout -b docs/core-architecture-refactor-v3
mkdir -p docs/handoff
mkdir -p docs/architecture
```

复制文档后：

```bash
git status
git add docs/handoff/
git add docs/architecture/
git add CHANGELOG.md
git commit -m "docs: define core architecture refactor scope"
git push origin docs/core-architecture-refactor-v3
```

不要使用：

```bash
git add .
```

## 四、如果已经有重构分支

如果你已经准备直接让 Codex 修改代码，也可以把文档提交到同一个重构分支：

```bash
git checkout -b refactor/core-scope-plan-report-reminder
git add docs/handoff/
git add docs/architecture/
git commit -m "docs: add architecture refactor handoff"
git push origin refactor/core-scope-plan-report-reminder
```


# ===== 10_first_message_for_new_window.md =====


# 10 新窗口首条消息建议

下面这段可以直接复制到新窗口发给 Codex / GLM。

---

现在开始「练刻 LiftMark 核心架构重构」。

不要继续零散修 Bug。  
不要继续围绕旧本地污染数据做兼容。  
本次以 fresh install / 清空 App 数据后的稳定主链路为验证基准。

请先读取最新文档：

```text
docs/handoff/
docs/architecture/
README.md
CHANGELOG.md
```

重点读取：

```text
账号作用域
小组
计划周期
计划归档
训练提醒
训练报告
热量估算
动作库接口预留
```

当前要求：

```text
1. 账号作用域必须彻底统一。
2. 188 测试账号旧数据可以清空或重建。
3. 176 主号服务器数据必须保护，不要删除。
4. 小组、计划、历史、首页必须有稳定空状态。
5. 计划必须支持周期、完成、归档、统计。
6. 能做的训练提醒先做本地通知。
7. 训练结束必须生成训练报告。
8. 热量消耗做估算值。
9. 动作 GIF / 图片暂不接入。
10. 动作库只保留数据结构、接口、icon_key、heatmap_key、media 字段。
11. 动作图标后续采用“肌群 + 动作类型”的统一图标系统。
```

开始前先执行：

```bash
git status
git log --oneline -8
git branch --show-current
```

新建分支：

```bash
git checkout -b refactor/core-scope-plan-report-reminder
```

禁止：

```text
git add .
提交密钥
提交 .env
提交数据库备份
提交临时截图
删除 176 主号服务器数据
把 176 数据迁移给 188
把 188 数据迁移给 176
```

请先输出：

```text
1. 当前 git 状态。
2. 你已读取的文档。
3. 计划修改的模块。
4. 是否需要后端 migration。
5. 是否需要服务器部署。
6. 第一轮最小可用目标。
```

然后再开始修改代码。

---
# v2.6.0 补充：训练提醒

训练提醒业务配置使用既有 `training_reminders` 同步实体；设备调度 ID 仅存在本地 SQLite，不跨设备同步。通知响应统一降级到今日训练页，避免失效计划或周期造成白屏。
