# Workout 模块实现文档

更新时间：2026-07-01  
对应代码目录：`training-partner-app/`；Sprint 4 已实现从今日训练创建 session、生成 records/sets、训练执行页和即时保存。

## 2026-07-01 addendum: group rotation, extra sets, rest focus, and summary source

- `RestTimerPanel` now has one primary action: "提前开始下一组" while counting down and "开始下一组" at zero. The action writes `actual_rest_seconds`.
- The workout route no longer lets a preferred member override the canonical rotation queue. Group rotation is always ordered by set number first and member order second; after the last member in a round finishes, the UI can focus that member's rest timer, then recomputes the next pending set from the full queue.
- The rest panel displays the currently resting member and the next member / next set label so the current training member and countdown are visible during group sessions.
- The workout options menu supports adding an extra set for the current member or for every member in the current exercise. Extra sets are written through `WorkoutRepository.addSetToExerciseRecord()`, start as incomplete, keep `notes: "加做组"`, and do not modify the original plan.
- `CurrentSetRecorder` saves valid weight / rep text changes immediately, so a no-suggestion exercise can be typed and completed without pressing Enter.
- The workout route falls back to the previous completed actual weight for the same member and exercise inside the current session.
- `WorkoutRepository.createSessionFromTodayPlan()` fills no-suggestion set weights from the member's latest completed historical set for that exercise.
- `app/workout/summary/[sessionId].tsx` shows the exercise / weight / reps source for the best estimated 1RM and removes the redundant "再看一次总结" action.

## 2026-06-30 补充：训练保存 P0、RPE、备注、实际休息与现场统计

- `app/workout/[sessionId].tsx` 使用 `WorkoutLiveStatsBar` 展示时长、容量、完成组数和平均 RPE。
- `CurrentSetRecorder` 默认保持重量/次数主流程，RPE 与本组备注收纳在可展开的高级记录区。
- 完成本组后，如果动作有计划休息，训练页为该成员开启休息状态；用户点击开始下一组时写入实际经过秒数，不在历史记录页默认展示休息秒。
- `WorkoutRepository.saveSet()` 持续作为训练现场唯一写入入口，保存 `actualWeight`、`actualReps`、`rpe`、`notes`、`actualRestSeconds`、`completed` 和 `skipped`。
- 小组训练轮换由 `getNextWorkoutSetForRotation()` 控制，顺序为同一动作内“set number 优先、成员顺序其次”，避免张三完成第 1 组后直接进入张三第 2 组。
- `getWorkoutExerciseSetProgress()` 提供当前组 / 计划组和已完成成员组 / 总成员组，不再用参与成员总 set 数充当计划组数。
- 完成本组前必须校验重量和次数；`NaN`、`Infinity`、负数、非法次数不会写入 Repository。超过 1000kg、0 次或超过 100 次需要用户确认。
- `checkShortWorkout()` 在完成训练前判断短训练或记录过少，并提示继续训练、保存记录或放弃本次。
- 保存 set / 完成 session 后会把 `workoutSets` / `workoutSessions` 写入 `local_sync_queue`，云端失败不影响本地训练现场。

## 2026-06-29 记录模式与参与成员

- `WorkoutSession.trainingMode` 新增 `solo_local` / `group_local`。
- `WorkoutRepository.createSessionFromTodayPlan()` 新增 `participantMemberIds` 和 `trainingMode` 输入；SQLite 实现只为参与成员生成 `workout_sets`。
- `workout_sessions.training_mode` 由 migration v7 添加，旧数据默认 `group_local`。
- `app/workout/[sessionId].tsx` 和 `app/workout/summary/[sessionId].tsx` 按 session sets 反推参与成员，避免展示未参与成员。
- `src/services/groupWorkoutConsentService.ts` 提供小组训练成员确认状态；当前仅本机展示授权边界，不执行远程同步。

## 1. 模块职责

创建训练 session、生成动作记录和每位成员的 set 记录，支撑训练现场多人轮换记录。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/workout/workout.types.ts` | 训练 session、动作记录、set 类型。 |
| `src/domain/workout/workout.service.ts` | set 数量、初始 reps、完成度统计。 |
| `src/domain/workout/workout.validation.ts` | 重量、次数、完成情况 输入校验。 |
| `src/data/repositories/workoutRepository.ts` | 训练记录 Repository 接口。 |
| `src/data/local/repositories/workoutRepository.ts` | 训练记录 SQLite Repository。 |
| `app/(tabs)/today.tsx` | 开始训练入口，传入过滤后的 `planExerciseIds`。 |
| `app/workout/[sessionId].tsx` | 训练执行页，按动作轮换。 |
| `app/workout/summary/[sessionId].tsx` | 训练总结页。 |
| `app/history/manual.tsx` | 历史训练补录入口，写入 workout 相关表。 |
| `app/history/[sessionId].tsx` | 历史训练详情和编辑入口。 |
| `src/tests/workout.test.ts` | Workout 领域规则测试。 |

## 3. 核心类/函数

### WorkoutRepository.createSessionFromTodayPlan

文件：见主要文件列表  
符号：`WorkoutRepository.createSessionFromTodayPlan`  
搜索锚点：`WorkoutRepository`  
职责：从今日计划创建 session、`workout_exercise_records` 和每位成员的 `workout_sets`；同一天已有 draft/in_progress session 时复用。  
调用方：today-training-flow, history, progression, export  
依赖：group, member, plan, exercise, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### WorkoutRepository.saveSet

文件：见主要文件列表  
符号：`WorkoutRepository.saveSet`  
搜索锚点：`WorkoutRepository`  
职责：保存单组实际重量、次数、完成情况、完成/跳过状态。  
调用方：workout-execution-flow, history, progression, export  
依赖：group, member, plan, exercise, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### WorkoutRepository.getSessionDetail

文件：见主要文件列表  
符号：`WorkoutRepository.getSessionDetail`  
搜索锚点：`WorkoutRepository`  
职责：恢复训练执行页所需的 session、动作记录和 set 记录。  
调用方：workout-execution-flow, history, progression, export  
依赖：group, member, plan, exercise, weight  
测试：见 `test-plan.md`  

修改注意：

1. 保持排序稳定，执行页默认按动作轮换。
2. 不能依赖组件局部状态恢复训练现场数据。
3. 修改后同步相关模块和流程文档。

### WorkoutRepository.finishSession

文件：见主要文件列表  
符号：`WorkoutRepository.finishSession`  
搜索锚点：`WorkoutRepository`  
职责：完成训练并生成总结。  
调用方：history, progression, export  
依赖：group, member, plan, exercise, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### WorkoutRepository.createManualSession

文件：见主要文件列表  
符号：`WorkoutRepository.createManualSession`  
职责：补录过去完成或自由训练创建的训练 session、动作记录和 set。  
调用方：`app/history/manual.tsx`、训练页自由训练入口。  
注意：补录训练只写训练记录，不回写或修改原计划。

### WorkoutRepository.updateSession / saveSet / delete*

文件：见主要文件列表  
职责：支持历史详情页修改日期、标题、组重量、次数、完成情况，并支持删除 set、动作记录或整次训练。危险删除必须二次确认。

### WorkoutRepository.updateExerciseRecordExercise

文件：见主要文件列表  
职责：训练中或历史编辑中替换当前训练动作快照。更新 `workout_exercise_records.exercise_id`，并在首次替换时通过 `replaced_from_exercise_id` 保留原计划动作。  
注意：该操作只影响本次训练 session，不修改 `plan_exercises`。

### 训练执行页 RPE 与休息

文件：`app/workout/[sessionId].tsx`、`src/components/workout/RpeSelector.tsx`、`src/components/workout/RestTimerPanel.tsx`、`src/components/workout/CurrentSetRecorder.tsx`  
职责：RPE 作为可选高级记录折叠展示，展开后使用横向数字选择器；完成一组后休息面板展示倒计时、建议休息、已休息、下一组和下一位成员，并在继续时保存 `actual_rest_seconds`。

## 4. 数据结构

- WorkoutSession
- WorkoutExerciseRecord
- WorkoutSet
- workout_sessions
- workout_exercise_records
- workout_sets

## 5. 调用关系

- 依赖：group, member, plan, exercise, weight
- 被调用：history, progression, export

## 6. 测试位置

- 可以完成一场 2-5 人训练。
- 中途退出再进入，记录仍然存在。
- 每位成员的重量、次数、完成情况 独立保存。
- `saveSet` 每次修改后立即写 SQLite。
- 训练执行页使用大按钮 stepper，避免频繁键盘输入。
- 历史补录和历史编辑必须写入 SQLite，且不能修改原计划。

建议测试文件：

- `src/tests/workout.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 训练现场输入必须低摩擦，不能频繁要求键盘输入。
- 训练进行中退出 App 不能丢 set 记录。
- 计划修改不能回写破坏已完成历史。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Workout 类型、校验/统计服务、Repository 接口和 SQLite 实现已创建。
- 2026-06-09：同步 Sprint 4：创建 session 时生成 records/sets，训练执行页按动作轮换记录多人 set，`saveSet` 即时保存。
- 2026-06-10：同步 Android development build 调整：训练记录仍只保存到 native SQLite；数据库初始化可安全重复调用，避免中途进入训练页时因重复 migrations/seed 影响首屏。
- 2026-06-10：同步 Gradle/JDK toolchain 修复：训练记录 Repository 未改动；Android 构建固定使用 JDK 17，完整训练执行烟测后续通过 APK 安装验证。
- 2026-06-10：同步本地 Android 预览 APK 流程：训练记录 Repository 和 SQLite schema 未改动；APK 首屏启动已通过，完整训练执行和退出重进恢复仍需后续手工烟测。
- 2026-06-12：同步可用性 + UI 落地 Sprint：新增历史补录、历史详情编辑、自由训练创建 session、训练页周五休息手动覆盖；新增 `createManualSession`、`updateSession`、`updateExerciseRecordExercise` 和删除接口。
- 2026-06-12：同步本地图片资产落地：训练执行页当前动作卡接入 `liftmarkImages.trainingHero` 图片背景和深色遮罩；训练总结页接入 `liftmarkImages.historyHero`。训练记录、即时保存和 Repository 接口未变。
- 2026-06-30：同步训练执行增强：RPE 改为可选折叠横向选择器，休息面板展示倒计时、建议休息、已休息、下一组和下一位成员；`saveSet` 保存 `actualRestSeconds`；训练中可打开动作替换弹层，替代动作优先按 `exercise_alternatives` 排序，替换关系保留 `replaced_from_exercise_id` 且不回写原计划。
- 2026-07-01：同步小组训练修复：轮换队列不再被选中成员覆盖，最后成员休息后回到第一位下一组；训练中可加做当前成员或全员额外组；总结页 1RM 指标展示动作来源并移除重复总结按钮。
