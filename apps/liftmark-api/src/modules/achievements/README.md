# Achievements API module

## Route

`GET /achievements/me` requires authentication and derives scope only from `authUser.id`. The mounted public path is `/api/achievements/me`.

Response:

```ts
{
  metrics: AchievementMetrics;
  achievements: AchievementProgress[];
  generatedAt: string;
}
```

## Metric rules

- A workout counts only when the session is completed, not deleted, and has at least one completed, non-skipped, non-deleted set.
- Volume is the sum of valid set weight multiplied by reps. Zero-weight sets can validate a workout but add no kg.
- Group workouts require `training_mode === group_local`; `group_id` alone is not sufficient.
- Completed cycles include completed or archived rows once each.
- Recovery check-ins are distinct by member and date.
- Active weeks run Monday through Sunday and use civil date strings.

## Reconciliation

The service loads enabled definitions once and the current user's existing rows once, builds an in-memory map, then upserts within one transaction. Progress is monotonic, achieved is sticky, and the first non-null `achieved_at` is preserved. The GET route does not mutate workout facts and does not delete legacy achievements.

## Seed and deployment

`db:seed` upserts the shared 11-code catalog by code and disables legacy `streak_3_days` without deleting definitions or user history. No PostgreSQL migration is required. After merge, build shared first, build/test the API, run the idempotent seed, reload `liftmark-api` using `ecosystem.config.js`, and verify health plus the authenticated route.
