export const initialSchemaSql = `
PRAGMA foreign_keys = ON;

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

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS exercise_alternatives (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  alternative_exercise_id TEXT NOT NULL,
  reason TEXT
);

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
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_phases (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);

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
`;
