# SQLite 数据库结构

更新时间：2026-06-15

## 1. 设计原则

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 多人逻辑从第一版就保留。
- 本地 SQLite 优先。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。

训练数据必须保存到 SQLite。AsyncStorage 只可用于轻量设置、首次启动标记、最近选中的 `group_id` 和主题偏好。

## 2. 表分组

| 分组 | 表 |
|---|---|
| 小组和成员 | `groups`, `group_members`, `member_profiles` |
| 动作和替代 | `exercises`, `exercise_alternatives` |
| 计划模板 | `plan_templates`, `plan_phases`, `plan_days`, `plan_exercises` |
| 实际训练 | `workout_sessions`, `workout_exercise_records`, `workout_sets` |
| 建议和恢复 | `progression_suggestions`, `recovery_logs` |
| 试用与激活 | `activation_state` |

Sprint 1 实现文件：

- `training-partner-app/src/data/local/schema.ts`
- `training-partner-app/src/data/local/migrations.ts`
- `training-partner-app/src/data/local/db.ts`

Sprint 3 seed 文件：

- `training-partner-app/src/data/seed/defaultExercises.ts`
- `training-partner-app/src/data/seed/defaultAlternatives.ts`
- `training-partner-app/src/data/seed/defaultStrengthPlan.ts`
- `training-partner-app/src/data/seed/defaultHypertrophyPlan.ts`
- `training-partner-app/src/data/seed/defaultDeloadPlan.ts`
- `training-partner-app/src/data/seed/classicPplPlan.ts`
- `training-partner-app/src/data/seed/seedDefaultData.ts`

当前 seed 幂等写入扩展系统动作库、动作替换、系统四练方案模板、系统“经典三分化 PPL”模板、默认用户计划副本和默认小组。系统方案不是用户计划；默认小组 `active_plan_id` 指向用户计划副本，不直接指向系统方案模板。新增 PPL seed 不需要 schema migration，不会覆盖用户已复制出的计划。

Sprint 4 训练执行：

- `workout_sessions` 保存一次训练 session。
- `workout_exercise_records` 保存从计划动作复制来的训练动作快照。
- `workout_sets` 保存每位成员每一组的 planned/actual 重量、次数、RPE/RIR 和完成状态。
- Sprint 4 未修改表结构，因此无需新增 migration。

## 3. 建表 SQL

### groups

```sql
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT,
  active_plan_id TEXT NOT NULL,
  current_phase_type TEXT NOT NULL,
  current_week INTEGER NOT NULL DEFAULT 1,
  friday_enabled INTEGER NOT NULL DEFAULT 0,
  friday_strategy TEXT NOT NULL DEFAULT 'default_rest',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`friday_enabled` 为旧兼容字段；`friday_strategy` 字段继续保留以兼容训练页。当前设置页不再暴露周五策略，后续策略入口应放在计划详情或训练页临时覆盖中。可选值为 `default_rest`、`allow_weak`、`allow_free`。

### group_members

```sql
CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### member_profiles

```sql
CREATE TABLE IF NOT EXISTS member_profiles (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  bodyweight REAL,
  bench_1rm REAL,
  squat_1rm REAL,
  deadlift_1rm REAL,
  overhead_press_1rm REAL,
  pullup_reference_weight REAL,
  barbell_increment REAL NOT NULL DEFAULT 2.5,
  dumbbell_increment REAL NOT NULL DEFAULT 2.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### exercises

```sql
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  category TEXT NOT NULL,
  movement_pattern TEXT NOT NULL,
  target_muscle TEXT NOT NULL,
  secondary_muscle TEXT,
  equipment TEXT NOT NULL,
  difficulty TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`source` 区分 `system` 和 `custom`。系统动作由 seed 按 ID 幂等更新；用户自定义动作由 Repository 写入，seed 不应覆盖。当前 migration v5 会为旧库补 `source` 列并创建 `idx_exercises_source_name`。

### exercise_alternatives

```sql
CREATE TABLE IF NOT EXISTS exercise_alternatives (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  alternative_exercise_id TEXT NOT NULL,
  reason TEXT
);
```

### plan_templates

```sql
CREATE TABLE IF NOT EXISTS plan_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'system',
  goal TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  frequency_per_week INTEGER NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  origin_scheme_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### plan_phases

```sql
CREATE TABLE IF NOT EXISTS plan_phases (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);
```

### plan_days

```sql
CREATE TABLE IF NOT EXISTS plan_days (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  title TEXT NOT NULL,
  focus TEXT NOT NULL,
  notes TEXT
);
```

### plan_exercises

```sql
CREATE TABLE IF NOT EXISTS plan_exercises (
  id TEXT PRIMARY KEY,
  plan_day_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  sets INTEGER,
  reps INTEGER,
  rep_min INTEGER,
  rep_max INTEGER,
  intensity_type TEXT NOT NULL,
  percent_1rm REAL,
  rpe_target REAL,
  rir_target REAL,
  fixed_weight REAL,
  reference_lift TEXT NOT NULL DEFAULT 'none',
  rest_seconds INTEGER,
  progression_rule_id TEXT,
  notes TEXT
);
```

### workout_sessions

```sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  phase_id TEXT,
  date TEXT NOT NULL,
  week INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### workout_exercise_records

```sql
CREATE TABLE IF NOT EXISTS workout_exercise_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  plan_exercise_id TEXT,
  exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  replaced_from_exercise_id TEXT,
  priority TEXT NOT NULL,
  planned_sets INTEGER,
  planned_reps INTEGER,
  planned_rep_min INTEGER,
  planned_rep_max INTEGER,
  planned_rpe REAL,
  planned_rir REAL,
  planned_percent_1rm REAL,
  planned_rest_seconds INTEGER,
  notes TEXT
);
```

### workout_sets

```sql
CREATE TABLE IF NOT EXISTS workout_sets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  exercise_record_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  planned_weight REAL,
  actual_weight REAL,
  planned_reps INTEGER,
  actual_reps INTEGER,
  rpe REAL,
  rir REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### progression_suggestions

```sql
CREATE TABLE IF NOT EXISTS progression_suggestions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  suggested_weight REAL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### recovery_logs

```sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  sleep_score INTEGER NOT NULL,
  appetite_score INTEGER NOT NULL,
  motivation_score INTEGER NOT NULL,
  soreness_score INTEGER NOT NULL,
  joint_pain_score INTEGER NOT NULL,
  fatigue_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  recommendation TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### activation_state

```sql
CREATE TABLE IF NOT EXISTS activation_state (
  id TEXT PRIMARY KEY,
  is_activated INTEGER NOT NULL DEFAULT 0,
  activation_code TEXT,
  activated_at TEXT,
  trial_started_at TEXT NOT NULL,
  trial_expires_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  app_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 4. 索引

```sql
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_member_id ON member_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_exercises_source_name ON exercises(source, name);
CREATE INDEX IF NOT EXISTS idx_plan_phases_plan_id ON plan_phases(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_days_phase_weekday ON plan_days(phase_id, week, weekday);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_day_id ON plan_exercises(plan_day_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_group_date ON workout_sessions(group_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_member_exercise ON workout_sets(member_id, exercise_record_id);
CREATE INDEX IF NOT EXISTS idx_progression_member_exercise ON progression_suggestions(member_id, exercise_id);
```

## 5. 未来同步字段

开发文档建议后续可增加：

```sql
ALTER TABLE workout_sessions ADD COLUMN remote_id TEXT;
ALTER TABLE workout_sessions ADD COLUMN sync_status TEXT DEFAULT 'local';
ALTER TABLE workout_sessions ADD COLUMN deleted_at TEXT;

ALTER TABLE workout_sets ADD COLUMN remote_id TEXT;
ALTER TABLE workout_sets ADD COLUMN sync_status TEXT DEFAULT 'local';
ALTER TABLE workout_sets ADD COLUMN deleted_at TEXT;
```

## 6. Migration 方案

Sprint 1 已落地 `schema_migrations` 版本表：

- 每个 migration 使用递增 `version` 和稳定 `name`。
- `runMigrations` 先创建版本表，再按版本顺序执行未应用 migration。
- 当前 v1 为 `initial_schema`，执行初始建表 SQL 和索引 SQL。
- 当前 v2 为 `plan_system_scheme_origin`，为 `plan_templates` 增加 `origin_scheme_id`，并把旧默认系统计划复制为用户计划副本后更新默认小组的 `active_plan_id`。
- 当前 v3 为 `friday_strategy_and_activation_state`，为 `groups` 增加 `friday_strategy`，并创建 `activation_state` 本地试用/激活状态表。
- 当前 v4 为 `workout_record_rest_time_snapshot`，为 `workout_exercise_records` 增加 `planned_rest_seconds`，补录休息时间可为空。
- 当前 v5 为 `exercise_source_for_custom_library`，为 `exercises` 增加 `source`，并创建 `idx_exercises_source_name`。
- 后续不能直接改旧 migration 语义，应追加新 migration。

## 7. 需要人工确认的问题

- 是否在 Sprint 1 就加入外键约束。
- 是否在 Sprint 1 就加入 `remote_id`、`sync_status`、`deleted_at`。
- 清空测试数据是否物理删除，真实数据是否软删除。
