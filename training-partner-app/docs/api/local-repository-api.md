# 本地 Repository API 文档

更新时间：2026-07-01

## 2026-07-01 契约补充：多动作补录、记录编辑和计划编辑

- `WorkoutRepository.createManualSession()` 支持新的 `exercises?: ManualWorkoutExerciseInput[]` 输入，可一次补录多个动作，每个动作包含独立 set 列表；旧 `exerciseId + setCount + weight + reps` 输入仍保留兼容。
- 新增 `WorkoutRepository.addExerciseToSession(input)`：用于历史详情编辑时向已存在 session 追加动作记录，可通过 `memberIds` 为本次参与成员批量创建初始组。
- 新增 `WorkoutRepository.addSetToExerciseRecord(input)`：用于历史详情编辑时向某个动作记录追加成员组，set number 按该动作 + 成员当前最大组号递增。
- `PlanRepository.createUserPlan()` 的 day 输入支持 `week?: number`，新建多训练日计划时不再强制写入第 1 周。
- 新增 `PlanRepository.updateUserPlan(input)`：仅允许更新非系统计划；保存时替换该计划的 phases / days / plan_exercises 结构，不触碰训练历史表。
- 移动端密码登录使用后端 `/auth/password/login`，请求体为 `{ identifier, password }`；旧 `/auth/login` `{ account, password }` 继续兼容。

## 2026-06-30 补充：Workout set 高级字段与 BodyMetricsRepository

- `WorkoutRepository.saveSet()` 现在可保存 `rpe?: number`、`notes?: string`、`actualRestSeconds?: number`。`rpe` 校验范围为 1-10 的整数，`actualRestSeconds` 必须是非负整数。
- `WorkoutRepository.saveSet()` 会拒绝 `NaN`、`Infinity`、负重量、非整数次数和非法 RPE；训练执行页在完成本组前校验重量/次数，异常大重量和 0 次会要求用户确认。
- 训练执行页保存 session / set 成功后调用 `enqueueSyncCandidate()` 写入 `local_sync_queue`，云端不可用时不回滚本地训练记录。
- `SaveWorkoutSetInput` 不接受新的 `rir` 写入；`rir` 仅为旧数据兼容字段。
- 新增 `BodyMetricsRepository`：

```ts
export interface BodyMetricsRepository {
  getMetricForDate(memberId: ID, date: string): Promise<BodyMetric | null>;
  getGoal(memberId: ID): Promise<BodyMetricGoal | null>;
  listMetrics(memberId: ID, limit?: number): Promise<BodyMetric[]>;
  upsertGoal(input: UpsertBodyMetricGoalInput): Promise<BodyMetricGoal>;
  upsertMetric(input: UpsertBodyMetricInput): Promise<BodyMetric>;
}
```

- `BodyMetric` 覆盖体重、体脂、胸围、腰围、臀围、肱二头肌围、大腿围、小腿围与备注；同一成员同一天写入时复用当天记录 ID。
- `BodyMetricGoal` 覆盖 `bulk` / `cut` / `maintain` 三类目标，目标体重和目标日期均为可选。

## 2026-06-30 契约补充

- `PlanRepository.listUserPlans()` 继续只返回用户计划，并过滤 legacy 旧默认计划。
- `PlanRepository.copySystemSchemeToUserPlan()` 是 onboarding 推荐计划落地当前计划前的唯一复制入口。
- `WorkoutRepository.createSessionFromTodayPlan()` 必须使用输入中的 `week`、`weekday`、`phaseId` 和 `planExerciseIds` 创建训练快照，不得从 group 当前周覆盖。
- 今日训练页的“动作筛选”通过 `planExerciseIds` 传入筛选后的计划动作列表；Repository 不得自行回退到固定计划日或硬编码动作。
- `WorkoutRepository.listOpenSessionsForDate()` 用于今日训练页检查同日未完成 session 冲突；不同计划、周次、训练日或记录模式不允许静默复用。

## 1. API 定位

本文件记录移动端 Repository 接口。它不是 HTTP API，而是 UI/Domain 与 SQLite 缓存之间的本地数据访问契约；云端同步通过 `src/sync/syncQueue.ts` 和 `src/sync/syncService.ts` 连接后端 `/api/sync/*`。

Repository 层不得让 UI 直接依赖 SQLite 实现。训练现场写入成功后，调用方负责把可同步实体写入同步队列；同步服务再把队列转换为服务端 `changes` payload。

Sprint 1 实现位置：

- 接口：`training-partner-app/src/data/repositories/`
- 本地 SQLite 实现：`training-partner-app/src/data/local/repositories/`
- 工厂：`training-partner-app/src/data/local/repositories/index.ts`

## 2. GroupRepository

```ts
export interface GroupRepository {
  listGroups(): Promise<Group[]>;
  getDefaultGroup(): Promise<Group | null>;
  getGroupById(id: ID): Promise<Group | null>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  updateGroup(id: ID, patch: Partial<Group>): Promise<Group>;
}
```

用途：

- 首次使用创建默认小组。
- `listGroups()` 用于当前小组切换、创建新小组后立即切换、历史/今日/成员页按当前小组隔离数据。
- 今日训练读取当前小组的计划、周期、周数和周五开关。
- 设置页更新小组状态。

## 3. MemberRepository

```ts
export interface MemberRepository {
  listMembers(groupId: ID): Promise<GroupMember[]>;
  getMemberProfile(memberId: ID): Promise<MemberProfile | null>;
  createMember(input: CreateMemberInput): Promise<GroupMember>;
  updateMember(id: ID, patch: Partial<GroupMember>): Promise<GroupMember>;
  updateProfile(memberId: ID, patch: Partial<MemberProfile>): Promise<MemberProfile>;
}
```

用途：

- 成员列表、成员表单。
- 今日训练建议重量计算。
- 训练记录按成员归属。
- `MemberProfile` 可保存成员头像 URL、缩略图 URL、本地缓存路径和更新时间；头像文件本体不进入 SQLite。

## 4. ExerciseRepository

```ts
export interface ExerciseRepository {
  getExerciseById(id: ID): Promise<Exercise | null>;
  listExercises(filters?: ListExercisesFilters): Promise<Exercise[]>;
  listExercisesByIds(ids: ID[]): Promise<Exercise[]>;
  findExerciseByName(name: string): Promise<Exercise | null>;
  createCustomExercise(input: CreateCustomExerciseInput): Promise<Exercise>;
  listAlternatives(exerciseId: ID): Promise<ExerciseAlternative[]>;
}
```

用途：

- 今日训练按 `exercise_id` 读取动作名、器械类型和目标肌群。
- 重量计算按动作器械类型选择杠铃或哑铃加重单位。
- 计划创建和历史补录通过统一动作选择器搜索系统/自定义动作。
- 用户可以快速新建自定义动作，Repository 负责名称去重和 SQLite 写入。
- 后续动作替换流程读取同模式替换项。

## 5. PlanRepository

```ts
export interface PlanRepository {
  getPlanById(planId: ID): Promise<PlanTemplate | null>;
  listUserPlans(): Promise<PlanTemplate[]>;
  listPlanPhases(planId: ID): Promise<PlanPhase[]>;
  listPlanDays(planId: ID): Promise<PlanDay[]>;
  listPlanExercises(planDayId: ID): Promise<PlanExercise[]>;
  createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate>;
  updateUserPlan(input: UpdateUserPlanInput): Promise<PlanTemplate>;
  copySystemSchemeToUserPlan(input: CopySystemSchemeToUserPlanInput): Promise<PlanTemplate>;
  importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate>;
  deleteUserPlan(planId: ID): Promise<void>;
  getTodayPlan(input: GetTodayPlanInput): Promise<TodayPlanResult>;
}
```

用途：

- 读取当前用户计划。
- 列出“我的计划”，不返回 `source=system` 的系统方案。
- 从创建计划页保存用户拥有的 `blank_created` 计划。
- 将完整可用的系统方案复制成用户计划。
- 将 `.liftmark.json` 导入草稿写入 SQLite，生成 `source: "imported"` 的用户计划。
- 删除用户计划，且不删除训练记录。
- 根据当前小组状态生成今日训练。
- 支持系统方案库、空白创建、导入和复制计划的未来扩展。

系统方案不是用户计划。训练记录不能直接绑定系统方案；训练页应通过 `groups.active_plan_id` 读取当前用户计划。

`importUserPlan` 不导入成员 1RM、身体数据、训练记录，不覆盖已有计划，也不允许把 `source: "system"` 的模板直接作为用户计划导入。导入动作按名称复用本机已有动作，缺失动作才新增。

`deleteUserPlan` 只允许删除非系统、非当前、非最后一个用户计划；只删除计划模板、阶段、训练日和计划动作，不删除 `workout_*` 训练记录表。

## 6. WorkoutRepository

```ts
export interface WorkoutRepository {
  createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession>;
  createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession>;
  getSession(sessionId: ID): Promise<WorkoutSession | null>;
  getSessionDetail(sessionId: ID): Promise<WorkoutSessionDetail>;
  updateSession(input: UpdateWorkoutSessionInput): Promise<WorkoutSession>;
  addExerciseToSession(input: AddWorkoutExerciseInput): Promise<WorkoutSessionDetail>;
  addSetToExerciseRecord(input: AddWorkoutSetInput): Promise<WorkoutSet>;
  updateExerciseRecordExercise(recordId: ID, exerciseId: ID): Promise<void>;
  saveSet(input: SaveWorkoutSetInput): Promise<WorkoutSet>;
  deleteSet(setId: ID): Promise<void>;
  deleteExerciseRecord(recordId: ID): Promise<void>;
  deleteSession(sessionId: ID): Promise<void>;
  finishSession(sessionId: ID): Promise<WorkoutSummary>;
  listSessions(input: ListSessionsInput): Promise<WorkoutSession[]>;
}
```

用途：

- 开始训练时创建或复用 session，并在同一事务中生成动作记录和参与成员的 set。
- 训练现场每次输入即时保存。
- 历史补录创建手动 session。
- 历史详情页可编辑日期、标题、动作、组数据，并可二次确认删除 set、动作或整次训练。
- 完成训练并生成总结。
- 历史页按日期、月份和成员条件读取训练。
- `updateExerciseRecordExercise(recordId, exerciseId)` 仅改当前训练动作快照的实际 `exercise_id`，并用 `COALESCE(replaced_from_exercise_id, exercise_id)` 保留首次原计划动作，不回写 `plan_exercises`。

`CreateSessionFromTodayPlanInput` 当前包含 `planExerciseIds?: ID[]`、`participantMemberIds?: ID[]` 和 `trainingMode?: 'solo_local' | 'group_local'`。今日训练页传入动作筛选后的动作列表和本次参与成员，Repository 只为参与成员生成 `workout_sets`。未完成的同计划、同周次、同训练日、同记录模式 session 会优先复用，避免中途退出后重复创建 set。

训练执行状态机：

- 单人：动作 A 第 1 组 -> 动作 A 第 2 组 -> 动作 A 完成后进入下一个动作。
- 小组：动作 A 张三第 1 组 -> 李四第 1 组 -> 张三第 2 组 -> 李四第 2 组 -> 下一个动作。
- `getNextWorkoutSetForRotation()` 和 `getWorkoutExerciseSetProgress()` 位于 `src/domain/workout/workout.service.ts`，页面不得重新手写组轮换算法。
- 保存失败时页面必须停留在当前组，并显示“本组数据未保存，请重试”。

## 6.1 SyncQueue / SyncService

```ts
export async function enqueueSyncCandidate(entity: SyncEntity): Promise<void>;
export async function countPendingSyncItems(): Promise<number>;
export async function listPendingSyncItems(limit?: number): Promise<SyncQueueItem[]>;
export async function requestImmediateSync(): Promise<{ ok: true; message?: string } | { ok: false; message: string }>;
```

移动端同步状态：

```text
local_only
pending_create
pending_update
pending_delete
syncing
synced
sync_failed
conflict
```

当前后端已支持 `exercises`、`workoutSessions`、`workoutSets`、`trainingPlans`、`planDays`、`planExercises` 的 `/api/sync/push` 通用 upsert。移动端本次先把训练 session / set 接入队列；小组、成员、计划、身体数据继续按该队列契约逐步接入。

## 7. ProgressionRepository

```ts
export interface ProgressionRepository {
  createSuggestionsForSession(sessionId: ID): Promise<ProgressionSuggestion[]>;
  listSuggestionsForMember(memberId: ID): Promise<ProgressionSuggestion[]>;
  getLatestSuggestion(memberId: ID, exerciseId: ID): Promise<ProgressionSuggestion | null>;
}
```

用途：

- 完成训练后生成进阶建议。
- 历史页展示每个成员最近建议。
- 今日训练可读取上次建议作为提示。

## 8. 设计约束

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 多人逻辑从第一版就保留。
- 云端优先，本地 SQLite 作为缓存与离线副本。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。

当前接口返回 Promise，并由 SQLite 实现直接抛出底层错误；Domain 层保持 UI 无关。

## 9. 需要人工确认的问题

- Repository 是否在第一版就接受事务对象。
- 本地 Repository 与未来 remote sync Repository 的接口拆分方式。
