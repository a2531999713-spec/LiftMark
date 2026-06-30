# SQLite 数据库结构

更新时间：2026-06-30

## 2026-06-30 补充：云同步元数据、训练记录增强与身体数据

- migration v10 新增云同步元数据：`remote_id`、`sync_status`、`sync_error`、`version` / `sync_version`、`last_synced_at`、`deleted_at`。覆盖 `groups`、`group_members`、`plan_templates`、`workout_sessions`、`workout_exercise_records`、`workout_sets`、`body_metrics`。
- 新增 `local_sync_queue`：记录本机待同步实体、操作类型、payload、尝试次数、错误信息和最近尝试时间。训练 session / set 保存后进入队列，云端不可用不阻断训练现场。
- 统一同步状态：`local_only`、`pending_create`、`pending_update`、`pending_delete`、`syncing`、`synced`、`sync_failed`、`conflict`。
- 本地 SQLite 不再是产品唯一真源；它承担缓存、副本、弱网训练、减少带宽和本机快速读取职责。

- `workout_sets` 新增 `actual_rest_seconds INTEGER`，用于记录完成本组后的实际休息秒数；`rpe` 与 `notes` 继续作为可选高级训练记录字段，旧 `rir` 仅保留兼容，不在新训练 UI 暴露。
- migration v11 为旧 SQLite 库的 `group_members` 补 `avatar_url TEXT`；新库初始 schema 已包含该列，用于避免旧库 onboarding 后读取头像列失败。
- 新增 `body_metrics`：`id`, `member_id`, `date`, `weight_kg`, `body_fat_percent`, `chest_cm`, `waist_cm`, `hip_cm`, `bicep_cm`, `thigh_cm`, `calf_cm`, `notes`, `created_at`, `updated_at`。
- 新增 `body_metric_goals`：按成员保存增肌 / 减脂 / 维持目标、可选目标体重、目标日期和备注。
- 新增索引 `idx_body_metrics_member_date`、`idx_body_metric_goals_member`，身体数据和目标走 SQLite 缓存与云同步队列，不使用 AsyncStorage。
- 账号头像缓存 `account_profile_cache` 与训练成员头像 `member_profiles` 仍分表保存；头像文件不进入 SQLite 二进制列。

## 1. 设计原则

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 多人逻辑从第一版就保留。
- 云端优先，本地 SQLite 作为缓存与离线副本。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。

训练数据必须保存到 SQLite。AsyncStorage 只可用于轻量设置、首次启动标记、最近选中的 `group_id` 和主题偏好。

## 2. 表分组

| 分组 | 表 |
|---|---|
| 小组和成员 | `groups`, `group_members`, `member_profiles` |
| 账号资料缓存 | `account_profile_cache` |
| 动作和替代 | `exercises`, `exercise_alternatives` |
| 计划模板 | `plan_templates`, `plan_phases`, `plan_days`, `plan_exercises` |
| 实际训练 | `workout_sessions`, `workout_exercise_records`, `workout_sets` |
| 身体数据 | `body_metrics`, `body_metric_goals` |
| 同步队列 | `local_sync_queue` |
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
- `training-partner-app/src/data/seed/mainstreamPlans.ts`
- `training-partner-app/src/data/seed/seedDefaultData.ts`

当前 seed 幂等写入扩展系统动作库、动作替换、主流系统计划库、经典四分化增肌计划、legacy 四练兼容模板、默认新手全身用户计划副本和默认小组。系统方案不是用户计划；默认小组 `active_plan_id` 指向用户计划副本，不直接指向系统方案模板。legacy 四练兼容模板仅用于兼容旧默认计划和历史记录，不进入新用户系统方案推荐。

Sprint 4 训练执行：

- `workout_sessions` 保存一次训练 session。
- `workout_exercise_records` 保存从计划动作复制来的训练动作快照。
- `workout_sets` 保存每位成员每一组的计划/实际重量、次数和完成状态；旧强度列只用于兼容既有本地数据。
- migration v7 新增 `workout_sessions.training_mode`，区分 `solo_local` 和 `group_local`。
- `workout_exercise_records.replaced_from_exercise_id` 保存训练中替换前的原计划动作；分析按当前 `exercise_id` 统计，历史详情可展示原动作 -> 实际动作。

Sprint 2026-06-30 云端优先同步：

- 移动端写入后先本地落库，再把实体写入 `local_sync_queue`。
- `/sync/push` 返回 `remote_id` / mapping 后，队列项标记为 `synced`；失败时保留 `sync_failed` 与错误信息，等待重试。
- 文件类数据不进入同步队列 payload：头像只同步元数据，压缩后图片由上传服务处理；训练摘要图、导出文件和调试日志默认本地生成。

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
  avatar_url TEXT,
  avatar_thumb_url TEXT,
  avatar_local_uri TEXT,
  avatar_updated_at TEXT,
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

头像字段只保存 URL、缩略图 URL、本地缓存路径和更新时间；SQLite 不保存图片二进制或 Base64。

### account_profile_cache

```sql
CREATE TABLE IF NOT EXISTS account_profile_cache (
  user_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  phone_masked TEXT,
  liftmark_id TEXT,
  avatar_url TEXT,
  avatar_thumb_url TEXT,
  avatar_local_uri TEXT,
  avatar_updated_at TEXT,
  updated_at TEXT NOT NULL
);
```

账号头像与训练成员头像分离。账号头像用于“我的”页和账号资料；成员头像归属于训练成员档案，用于训练成员列表和训练现场。

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
  training_mode TEXT NOT NULL DEFAULT 'group_local',
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

旧强度字段继续留在 SQLite schema 中用于读取历史数据和兼容旧库；当前 UI、seed 和计划导入导出不再把这些字段作为用户功能展示。

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

### body_metrics

```sql
CREATE TABLE IF NOT EXISTS body_metrics (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  weight_kg REAL,
  body_fat_percent REAL,
  chest_cm REAL,
  waist_cm REAL,
  hip_cm REAL,
  bicep_cm REAL,
  thigh_cm REAL,
  calf_cm REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### body_metric_goals

```sql
CREATE TABLE IF NOT EXISTS body_metric_goals (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_weight_kg REAL,
  target_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_body_metrics_member_date ON body_metrics(member_id, date);
CREATE INDEX IF NOT EXISTS idx_body_metric_goals_member ON body_metric_goals(member_id);
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
- 当前 v6 为 `account_and_member_avatar_cache`，为 `member_profiles` 增加头像 URL / 缩略图 / 本地路径 / 更新时间字段，并创建 `account_profile_cache`。
- 当前 v7 为 `workout_session_training_mode`，为 `workout_sessions` 增加 `training_mode`。
- 当前 v8 为 `workout_set_rest_and_body_metrics`，为 `workout_sets` 增加 `actual_rest_seconds`，并创建 `body_metrics` 与 `idx_body_metrics_member_date`。
- 当前 v9 为 `body_metric_goals`，创建身体目标表与 `idx_body_metric_goals_member`。
- 后续不能直接改旧 migration 语义，应追加新 migration。

## 7. 需要人工确认的问题

- 是否在 Sprint 1 就加入外键约束。
- 是否在 Sprint 1 就加入 `remote_id`、`sync_status`、`deleted_at`。
- 重建测试数据是否物理删除，真实数据是否软删除。
