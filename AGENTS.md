# LiftMark Agent Rules

This file contains long-term instructions for Codex and other coding agents working on the LiftMark repository.

Unless the user explicitly updates these rules, they are always active.

## 1. Required pre-work before editing code

Before making code changes, read the latest project documentation. At minimum, check:

```text
docs/handoff/
docs/architecture/
README.md
CHANGELOG.md
training-partner-app/docs/technical-architecture.md
training-partner-app/docs/sync-architecture.md
training-partner-app/docs/database/schema.md
training-partner-app/docs/api/local-repository-api.md
training-partner-app/docs/ai-development-rules.md
```

If any path does not exist, search the repository for the latest handoff, architecture, sync, database, and development-rule documents. Do not skip documentation review.

Before editing, always run:

```bash
git status
git log --oneline -8
git branch --show-current
```

Do not work directly on `master` or `main`. Create or confirm a task branch first.

Before changing files, output an execution plan that includes:

```text
1. Documents read
2. Current git status
3. Current branch
4. Modules to modify
5. Whether mobile SQLite migration is needed
6. Whether backend PostgreSQL migration is needed
7. Whether server deployment is needed
8. Minimum viable target for this task
9. Risks and protection measures
```

## 2. Core architecture principle

LiftMark must be understood through this core chain:

```text
Account Scope → Group → Plan → Plan Cycle → Workout Execution → Training Report → Sync
```

All core data must have clear ownership and scope. Pay special attention to:

```text
owner_user_id
group_id
plan_id
plan_cycle_id
plan_day_id
plan_exercise_id
exercise_id
member_id
recorded_by_user_id
source_device_id
sync_status
remote_id
last_synced_at
updated_at
deleted_at
```

Screens must not bypass repositories to query global data directly. Repository queries must enter the current account scope and group scope.

## 3. Data protection rules

The 176 account is the primary real account and must be protected:

```text
user_id = usr_35c96ce5f49045448bae4ec1dd5340a6
nickname = 练刻管理员
```

Do not delete, migrate, or accidentally modify this account's server training data.

The 188 account is a test account:

```text
user_id = usr_90fe5d00deaf431c8a15e140b056ff8e
nickname = 练刻用户3716
```

Old 188 test data may be cleared, deleted, or rebuilt. Do not preserve old polluted local data at the cost of the new architecture.

Strictly forbidden:

```text
1. Delete 176 server training data.
2. Migrate 176 data to 188.
3. Migrate 188 data to 176.
4. Run destructive SQL without backup.
5. Bulk-change owner_user_id for workout, plan, or measurement data without explicit review.
6. Let 188 read 176 group / plan / workout data to make the account appear non-empty.
```

## 4. Verification baseline

Important refactors must use this baseline:

```text
fresh install / cleared app data stable main flow
```

Do not break the new architecture to support old polluted local SQLite data.

## 5. Sync architecture rules

Use the latest sync model:

```text
Local SQLite is the business read/write entry.
Workout execution must write local SQLite first.
PostgreSQL is the authoritative cloud recovery and conflict arbitration source.
Sync should pull before push.
Login / account switching must use fullPull.
fullPull must use account-scoped context.
Sync cursors must be account-scoped, such as last_pull_at:{userId}.
```

Maintain these rules:

```text
1. Workout execution must not require the server to succeed before local save succeeds.
2. Cloud failure must not lose local workout data.
3. After account switching, never upload the previous account's pending data.
4. local_sync_queue must carry owner_user_id or reliable account context.
5. fullPull / restoreFromCloud must not rely on since filters.
6. Incremental sync may use account-scoped last_pull_at.
7. owner_user_id must not be overwritten by ordinary UPDATE operations after creation.
```

## 6. Exercise media rules

Do not integrate third-party exercise GIFs, images, or videos at this stage.

Only reserve:

```text
exercise catalog interfaces
exercise media fields
icon_key
heatmap_key
movement_pattern
primary_muscle
secondary_muscles
muscle_activation_json
```

Future exercise icons should use:

```text
muscle group + movement pattern
```

Do not package third-party media resources into the APK.

## 7. Git and file restrictions

Never use:

```bash
git add .
```

Stage files by explicit paths only.

Never commit:

```text
.env
.pem
secrets
database passwords
Aliyun keys
server keys
database backups
temporary screenshots
zip files
debug logs
uploads/
node_modules/
```

Also forbidden:

```text
1. Modify node_modules.
2. Store workout records in AsyncStorage.
3. Hard-code training plans inside React page components.
4. Implement single-user-only workout logic.
5. Require internet access during workout execution.
6. Turn the workout execution page into an Excel-style table.
7. Execute system schemes directly as user plans.
8. Bind workout records directly to system schemes.
9. Let plan edits corrupt historical records.
10. Let repositories bypass account scope and query global data.
```

## 8. Required final output

After completing a task, output:

```text
1. Summary of changes
2. Modified file list
3. Affected modules
4. Database / migration changes
5. Whether server deployment is needed
6. Validation results
7. Test command results
8. Commit hash
9. Known remaining issues
10. Recommended next steps
```

If a test cannot be run, state the reason clearly. Do not pretend it passed.
