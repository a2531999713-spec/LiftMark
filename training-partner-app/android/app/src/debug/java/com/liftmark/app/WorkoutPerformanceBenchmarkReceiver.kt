package com.liftmark.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.SystemClock
import android.util.Log

class WorkoutPerformanceBenchmarkReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION) return
    val pendingResult = goAsync()
    Thread {
      try {
        runBenchmarks(context.applicationContext)
        Log.i(TAG, "benchmark=complete database=isolated")
      } catch (error: Throwable) {
        Log.e(TAG, "benchmark=failed", error)
      } finally {
        pendingResult.finish()
      }
    }.start()
  }

  private fun runBenchmarks(context: Context) {
    context.deleteDatabase(DATABASE_NAME)
    val db = context.openOrCreateDatabase(DATABASE_NAME, 0, null)
    try {
      db.execSQL("CREATE TABLE workout_sessions(id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, status TEXT NOT NULL, finished_at TEXT, sync_status TEXT NOT NULL, updated_at TEXT NOT NULL)")
      db.execSQL("CREATE TABLE workout_sets(id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, session_id TEXT NOT NULL, exercise_record_id TEXT NOT NULL, member_id TEXT NOT NULL, actual_weight REAL, actual_reps INTEGER, rpe INTEGER, notes TEXT, completed INTEGER NOT NULL, skipped INTEGER NOT NULL, sync_status TEXT NOT NULL, updated_at TEXT NOT NULL)")
      db.execSQL("CREATE TABLE local_sync_queue(id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, entity_type TEXT NOT NULL, local_id TEXT NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL)")
      db.execSQL("CREATE INDEX idx_workout_sets_session_id ON workout_sets(session_id)")
      db.execSQL("CREATE INDEX idx_local_sync_queue_owner_status ON local_sync_queue(owner_user_id, status, updated_at)")
      listOf(
        Scenario("A", 5, 3, 1),
        Scenario("B", 8, 4, 2),
        Scenario("C", 10, 5, 4),
      ).forEach { runScenario(db, it) }
    } finally {
      db.close()
      check(context.deleteDatabase(DATABASE_NAME)) { "isolated benchmark database cleanup failed" }
    }
  }

  private fun runScenario(db: SQLiteDatabase, scenario: Scenario) {
    db.delete("local_sync_queue", null, null)
    db.delete("workout_sets", null, null)
    db.delete("workout_sessions", null, null)
    val sessionId = "benchmark_${scenario.name}"
    val setCount = scenario.exerciseCount * scenario.setsPerExercise * scenario.memberCount
    seedScenario(db, sessionId, scenario, setCount)

    val patches = linkedMapOf<String, Patch>()
    repeat(setCount) { index ->
      val setId = "${sessionId}_set_$index"
      patches[setId] = Patch(weight = 40.0)
      patches[setId] = patches.getValue(setId).copy(weight = 42.5)
      patches[setId] = patches.getValue(setId).copy(reps = 8)
      patches[setId] = patches.getValue(setId).copy(notes = "ok")
      patches[setId] = patches.getValue(setId).copy(completed = true)
    }

    val completeStarted = SystemClock.elapsedRealtimeNanos()
    transaction(db) {
      db.execSQL(
        "UPDATE workout_sets SET actual_weight=?, actual_reps=?, completed=1, sync_status='pending_update', updated_at=? WHERE id=? AND session_id=?",
        arrayOf(42.5, 8, now(), "${sessionId}_set_0", sessionId),
      )
    }
    val completeSetMs = elapsedMs(completeStarted)

    val adjustmentStarted = SystemClock.elapsedRealtimeNanos()
    transaction(db) {
      db.execSQL(
        "UPDATE workout_sets SET skipped=1, sync_status='pending_update', updated_at=? WHERE session_id=? AND member_id=? AND completed=0",
        arrayOf(now(), sessionId, "member_0"),
      )
    }
    val adjustmentMs = elapsedMs(adjustmentStarted)

    val finishStarted = SystemClock.elapsedRealtimeNanos()
    transaction(db) {
      patches.forEach { (setId, patch) ->
        db.execSQL(
          "UPDATE workout_sets SET actual_weight=?, actual_reps=?, notes=?, completed=?, skipped=0, sync_status='pending_update', updated_at=? WHERE id=? AND session_id=?",
          arrayOf(patch.weight, patch.reps, patch.notes, if (patch.completed) 1 else 0, now(), setId, sessionId),
        )
      }
      db.execSQL(
        "UPDATE workout_sessions SET status='completed', finished_at=?, sync_status='pending_update', updated_at=? WHERE id=?",
        arrayOf(now(), now(), sessionId),
      )
    }
    val finishMs = elapsedMs(finishStarted)

    val queueStarted = SystemClock.elapsedRealtimeNanos()
    transaction(db) {
      patches.keys.forEachIndexed { index, setId ->
        db.execSQL(
          "INSERT INTO local_sync_queue(id, owner_user_id, entity_type, local_id, operation, status, updated_at) VALUES(?, 'isolated_benchmark_user', 'workoutSets', ?, 'update', 'pending_update', ?)",
          arrayOf("${sessionId}_queue_$index", setId, now()),
        )
      }
    }
    val queueMs = elapsedMs(queueStarted)

    val completedCount = db.rawQuery(
      "SELECT COUNT(*) FROM workout_sets WHERE session_id=? AND completed=1",
      arrayOf(sessionId),
    ).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) }
    check(completedCount == setCount) { "scenario ${scenario.name} lost workout sets" }
    check(completeSetMs <= 700.0) { "scenario ${scenario.name} complete set exceeded 700ms" }
    check(finishMs <= 2500.0) { "scenario ${scenario.name} finish exceeded 2500ms" }

    Log.i(
      TAG,
      "scenario=${scenario.name} setCount=$setCount inputEvents=${setCount * 5} finalPatchCount=${patches.size} " +
        "completeSetMs=${format(completeSetMs)} adjustmentMs=${format(adjustmentMs)} " +
        "finishMs=${format(finishMs)} queueMs=${format(queueMs)} " +
        "dataWrites=${setCount + 1} queueWrites=$setCount",
    )
  }

  private fun seedScenario(db: SQLiteDatabase, sessionId: String, scenario: Scenario, setCount: Int) {
    transaction(db) {
      db.execSQL(
        "INSERT INTO workout_sessions(id, owner_user_id, status, sync_status, updated_at) VALUES(?, 'isolated_benchmark_user', 'in_progress', 'local_only', ?)",
        arrayOf(sessionId, now()),
      )
      repeat(setCount) { index ->
        db.execSQL(
          "INSERT INTO workout_sets(id, owner_user_id, session_id, exercise_record_id, member_id, completed, skipped, sync_status, updated_at) VALUES(?, 'isolated_benchmark_user', ?, ?, ?, 0, 0, 'local_only', ?)",
          arrayOf(
            "${sessionId}_set_$index",
            sessionId,
            "exercise_${index / (scenario.setsPerExercise * scenario.memberCount)}",
            "member_${index % scenario.memberCount}",
            now(),
          ),
        )
      }
    }
  }

  private inline fun transaction(db: SQLiteDatabase, block: () -> Unit) {
    db.beginTransaction()
    try {
      block()
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  private fun elapsedMs(startedAt: Long): Double =
    (SystemClock.elapsedRealtimeNanos() - startedAt) / 1_000_000.0

  private fun format(value: Double): String = String.format(java.util.Locale.US, "%.3f", value)
  private fun now(): String = System.currentTimeMillis().toString()

  private data class Patch(
    val weight: Double = 0.0,
    val reps: Int = 0,
    val notes: String = "",
    val completed: Boolean = false,
  )

  private data class Scenario(
    val name: String,
    val exerciseCount: Int,
    val setsPerExercise: Int,
    val memberCount: Int,
  )

  companion object {
    private const val ACTION = "com.liftmark.app.RUN_WORKOUT_BENCHMARK"
    private const val DATABASE_NAME = "workout_write_pipeline_v2111_benchmark.db"
    private const val TAG = "workout-finish-performance"
  }
}
