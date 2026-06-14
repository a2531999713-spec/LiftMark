# 本地 Repository API 文档

更新时间：2026-06-14

## 1. API 定位

本文件记录第一版本地 Repository 接口。它不是 HTTP API，而是 UI/Domain 与 SQLite 之间的本地数据访问契约。

Repository 层必须保留后续 remote sync 接口空间，不应让 UI 直接依赖 SQLite 实现。

Sprint 1 实现位置：

- 接口：`training-partner-app/src/data/repositories/`
- 本地 SQLite 实现：`training-partner-app/src/data/local/repositories/`
- 工厂：`training-partner-app/src/data/local/repositories/index.ts`

## 2. GroupRepository

```ts
export interface GroupRepository {
  getDefaultGroup(): Promise<Group | null>;
  getGroupById(id: ID): Promise<Group | null>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  updateGroup(id: ID, patch: Partial<Group>): Promise<Group>;
}
```

用途：

- 首次使用创建默认小组。
- 今日训练读取当前计划、周期、周数和周五开关。
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

## 4. ExerciseRepository

```ts
export interface ExerciseRepository {
  getExerciseById(id: ID): Promise<Exercise | null>;
  listExercises(): Promise<Exercise[]>;
  listExercisesByIds(ids: ID[]): Promise<Exercise[]>;
  listAlternatives(exerciseId: ID): Promise<ExerciseAlternative[]>;
}
```

用途：

- 今日训练按 `exercise_id` 读取动作名、器械类型和目标肌群。
- 重量计算按动作器械类型选择杠铃或哑铃加重单位。
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
  copySystemSchemeToUserPlan(input: CopySystemSchemeToUserPlanInput): Promise<PlanTemplate>;
  importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate>;
  getTodayPlan(input: GetTodayPlanInput): Promise<TodayPlanResult>;
}
```

用途：

- 读取当前用户计划。
- 列出“我的计划”，不返回 `source=system` 的系统方案。
- 从创建计划页保存用户拥有的 `blank_created` 计划。
- 将完整可用的系统方案复制成用户计划。
- 将 `.liftmark.json` 导入草稿写入 SQLite，生成 `source: "imported"` 的用户计划。
- 根据当前小组状态生成今日训练。
- 支持系统方案库、空白创建、导入和复制计划的未来扩展。

系统方案不是用户计划。训练记录不能直接绑定系统方案；训练页应通过 `groups.active_plan_id` 读取当前用户计划。

`importUserPlan` 不导入成员 1RM、身体数据、训练记录，不覆盖已有计划，也不允许把 `source: "system"` 的模板直接作为用户计划导入。

## 6. WorkoutRepository

```ts
export interface WorkoutRepository {
  createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession>;
  createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession>;
  getSession(sessionId: ID): Promise<WorkoutSession | null>;
  getSessionDetail(sessionId: ID): Promise<WorkoutSessionDetail>;
  updateSession(input: UpdateWorkoutSessionInput): Promise<WorkoutSession>;
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

- 开始训练时创建或复用 session，并在同一事务中生成动作记录和每位成员的 set。
- 训练现场每次输入即时保存。
- 历史补录创建手动 session。
- 历史详情页可编辑日期、标题、动作、组数据，并可二次确认删除 set、动作或整次训练。
- 完成训练并生成总结。
- 历史页按日期、月份和成员条件读取训练。

`CreateSessionFromTodayPlanInput` 当前包含 `planExerciseIds?: ID[]`，用于从今日训练页传入恢复过滤后的动作列表。未完成的当天 session 会优先复用，避免中途退出后重复创建 set。

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
- 本地 SQLite 优先。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。

当前接口返回 Promise，并由 SQLite 实现直接抛出底层错误；Domain 层保持 UI 无关。

## 9. 需要人工确认的问题

- Repository 是否在第一版就接受事务对象。
- 本地 Repository 与未来 remote sync Repository 的接口拆分方式。
