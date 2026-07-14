# v2.7.1 stability handoff

- Workout completion is local-first: flush pending SQLite writes, finish the session, route to the summary, then request sync in the background.
- A set completion never calls the finish action. The final completion card remains the only route to finish a workout.
- Reports read `estimated_calories_min` and `estimated_calories_max`; missing legacy reports remain read-only fallbacks.
- Pull repairs a member id only with exact `local_member_id` or `remote_id` evidence in the current account and group. It does not infer by user id or rewrite unscoped body metrics.
- No SQLite/PostgreSQL migration, API change, server deployment, or production-data operation is required.
