# 练刻 LiftMark

LiftMark is a three-client strength-training system. Mobile training writes to SQLite first; PostgreSQL is the authoritative cloud recovery and conflict-arbitration source.

## Current release: v2.11.1 workout write-pipeline stabilization

- Workout input now coalesces the latest patch per set instead of appending an unbounded Promise chain.
- Batch SQLite repository methods and one atomic finish transaction persist final sets and the completed session before summary navigation.
- Sync queue reconstruction, reports, progression, achievements, and network sync run after navigation and never block local workout completion.
- Execution phases, double-submit locks, save-and-exit semantics, real set-derived progress, bodyweight completion, and multi-member adjustments are covered by regression tests.
- No SQLite/PostgreSQL migration, API change, or server deployment is required for v2.11.1.

## Previous release: v2.11.0 training continuity and achievements

- Eleven stable, account-scoped milestones are calculated from valid completed workouts, active Monday-to-Sunday weeks, volume, group workouts, plan cycles, and recovery check-ins.
- Achievement progress is available offline from SQLite, then reconciled monotonically with `GET /api/achievements/me` when the cloud is reachable.
- The Today screen has a compact continuity card, `/achievements` provides the full center, and newly reached milestones appear after workout summary navigation without blocking the workout finish path.
- The legacy daily-streak definition is disabled rather than deleted. v2.11.0 adds no leaderboard, points, store, group challenge, or daily-training pressure.
- No SQLite or PostgreSQL schema migration is required. The API and idempotent achievement seed must be deployed after merge.

## Previous release: v2.10.0 recovery readiness

- Six daily signals produce deterministic recovery guidance and an optional, session-only training adjustment.
- The Today screen loads recovery independently from the plan so a recovery read failure cannot block workout startup.
- Recovery records are account-, group-, and member-scoped, written to SQLite first, and synchronized through the existing `recoveryLogs` contract.
- Recovery guidance never modifies plan templates, historical workouts, or long-term progression suggestions.

## Repository structure

| Path | Responsibility |
|---|---|
| `training-partner-app/` | Expo / React Native mobile app for iOS and Android, local workout execution, SQLite repositories, reports, reminders, and sync queue. |
| `apps/liftmark-api/` | Fastify / Knex / PostgreSQL API for authentication, groups, transactional sync, workouts, and admin APIs. |
| `management-console/` | Next.js operations console. It consumes the API and does not contain the API server. |
| `packages/shared/` | Minimal cross-client DTOs, sync entity names, status values, and error codes. |
| `docs/` | Architecture, handoff, database, deployment, and verification documentation. |
| `scripts/` | Explicit operational and diagnostic scripts. Review scripts before running them against any environment. |

Core data flow:

```text
Authenticated Account -> AccountScope -> Group -> Member -> Plan -> Plan Cycle
-> Workout Execution -> Training Report -> Account-Scoped Sync Queue
-> Transactional Server Sync
```

LiftMark v2.9.0 adds a metadata-first recommended plan library at `/plan/library` and a complete read-only system scheme preview at `/plan/scheme/[schemeId]`. Detail loading follows `scheme -> template -> phases/days -> batched prescriptions -> batched exercises`; copying creates an account-owned plan, activates it for the selected group, and ensures an active plan cycle. See [`docs/03-architecture/system-plan-library-preview-implementation-2026-07.md`](./docs/03-architecture/system-plan-library-preview-implementation-2026-07.md).

The mobile P1 plan-cycle/report/history flow is implemented on the existing local-first architecture: training completion produces an account-scoped report, plan-cycle completion/archive produces an idempotent summary, and history supports current/archive/free/manual filters without N+1 detail reads. See `docs/03-architecture/plan-cycle-report-history-implementation-2026-07.md` for routes, data flow, scope rules, tests, and the remaining device acceptance step.

Training reminder settings are local-notification first: business configuration syncs by account and group, while Expo schedule identifiers stay on the current device. See `docs/03-architecture/training-reminder-implementation-2026-07.md`.

The v2.7.1 stability pass keeps workout completion local-first, restores report/history resilience, and tightens safe member-id repair after pull without relaxing account or group scope. See `docs/03-architecture/workout-report-history-stability-implementation-2026-07.md`.

The v2.7.2 consistency pass restores data-rich record insights, resolves onboarding per account after recovery, moves body metrics into “我的”, and excludes unfinished sessions from dashboard statistics. See `docs/03-architecture/history-onboarding-bodymetrics-plan-consistency-implementation-2026-07.md`.

The v2.8.0 progression pass creates deterministic, member-and-exercise scoped next-session suggestions locally after a completed workout. It never rewrites plans or historical sets; see `docs/03-architecture/progression-suggestions-implementation-2026-07.md`.

## Requirements

- Node.js 22.13 or newer.
- npm for the mobile app and API; the management console currently has an npm lockfile and must not mix package managers.
- JDK 17 plus Android SDK 36 / NDK 27.1 for Android builds. Do not use Java 24.
- PostgreSQL for API development.
- Secrets supplied through untracked environment files. Never commit `.env`, `.pem`, tokens, database URLs, SMS credentials, backups, uploads, logs, or screenshots.

## Mobile app

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm install
npm run start
```

Useful commands:

```powershell
npm run android
npm run ios
npm run typecheck
npm run lint
npm test -- --runInBand
```

Android arm64 release verification:

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app\android
$env:PATH = "D:\Setup\nodejs;" + $env:PATH
.\gradlew.bat assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```

## API

Create an untracked `.env` from `apps/liftmark-api/.env.example`, then:

```powershell
cd C:\Users\zhw\Documents\LiftMark\apps\liftmark-api
npm install
npm run typecheck
npm run build
npm run dev
```

Production requires explicit secrets and `CORS_ALLOWED_ORIGINS`. Database migrations are append-only and must be reviewed, backed up, and run separately from application deployment.

## Management console

Create an untracked `.env.local` from `management-console/.env.example`, then:

```powershell
cd C:\Users\zhw\Documents\LiftMark\management-console
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` is required. Production API addresses are configuration, never hard-coded source values.

## Documentation

- Architecture target: [`LiftMark-完整架构设计方案.md`](./LiftMark-完整架构设计方案.md)
- Phased convergence plan: [`练刻 LiftMark 分阶段架构收敛执行计划.md`](./练刻%20LiftMark%20分阶段架构收敛执行计划.md)
- Current-state audit: [`docs/03-architecture/current-state-audit-2026-07-11.md`](./docs/03-architecture/current-state-audit-2026-07-11.md)
- Plan prescription editor: [`docs/03-architecture/plan-exercise-prescription-editor-implementation-2026-07.md`](./docs/03-architecture/plan-exercise-prescription-editor-implementation-2026-07.md)
- Handoff entry: [`docs/handoff/00_README_交接入口.md`](./docs/handoff/00_README_交接入口.md)
- Mobile technical architecture: [`training-partner-app/docs/technical-architecture.md`](./training-partner-app/docs/technical-architecture.md)
- Sync architecture: [`training-partner-app/docs/sync-architecture.md`](./training-partner-app/docs/sync-architecture.md)
- Database schema: [`training-partner-app/docs/database/schema.md`](./training-partner-app/docs/database/schema.md)
- API deployment guide: [`training-partner-app/docs/backend-deploy-guide.md`](./training-partner-app/docs/backend-deploy-guide.md)

## Data and migration rules

- SQLite and PostgreSQL migrations are append-only. Never edit a released migration or delete production tables.
- Protect the production account and never reassign workout, plan, measurement, or report ownership between accounts.
- Workout execution must succeed locally without network access. Cloud failure keeps local data queued for retry.
- Pull precedes push; full restore does not use `since`; cursors and queues are account-scoped.
- Do not run production migrations, repair SQL, seeds, deployments, PM2 restarts, or Nginx changes from ordinary development tasks.
