# Training 模块实现文档

更新时间：2026-06-14

## 本次实现

- `app/workout/[sessionId].tsx` 支持完成本组后的自动推进。
- `app/workout/[sessionId].tsx` 已将 RPE/RIR 从“数值输入 + preset”改为纯 preset 点选；RPE 为 `6-10/清空`，RIR 为 `0-5/清空`，不再弹出键盘。
- 计划动作的 `rest_seconds` 在创建训练时写入 `workout_exercise_records.planned_rest_seconds`，作为训练记录快照。
- 新增 SQLite migration v4：`workout_record_rest_time_snapshot`，可重复执行检查字段是否存在。
- `WorkoutExerciseRecord` 新增 `plannedRestSeconds`，补录输入新增 `restSeconds?: number | null`。
- `validateWorkoutSetInput` 收紧校验：重量非负，次数为非负整数，RPE 为空或 6-10，RIR 为空或 0-5。

## 自动推进流程

1. 用户点击“完成本组”。
2. 页面保存当前轮次所有目标 set。
3. 如果当前动作还有下一组：
   - 有休息时间时显示倒计时；
   - 倒计时结束或用户点击跳过休息后进入下一组；
   - 无休息时间时直接进入下一组。
4. 如果当前动作已完成且还有下一个动作，自动切换到下一个动作。
5. 如果已是最后一个动作，主按钮切换为“完成训练并查看总结”。

## 已完成组编辑实现

- 已完成组列表直接使用已有 `workout_sets` 行。
- 编辑已完成组调用 `workoutRepository.saveSet` 更新原行，避免重复记录。
- 编辑已完成组时重量/次数仍可直接输入并用加减号微调，RPE/RIR 只允许通过 preset 点选或清空。
- 删除已完成组调用 `workoutRepository.deleteSet`，先二次确认。
- 撤销上一组调用 `saveSet({ completed: false, skipped: false })`，保留原 set 行，避免破坏训练总结。

## 补录间歇时间

- `app/history/manual.tsx` 新增“间歇秒”可选输入。
- 留空写入 `null`。
- 间歇时间为空不影响训练量、PR 和估算 1RM。
- 当前版本未做训练密度/疲劳分析，因此空间歇不会参与相关计算。

## 相关文件

- `app/workout/[sessionId].tsx`
- `app/history/manual.tsx`
- `src/domain/workout/workout.types.ts`
- `src/domain/workout/workout.validation.ts`
- `src/data/local/schema.ts`
- `src/data/local/migrations.ts`
- `src/data/local/repositories/mappers.ts`
- `src/data/local/repositories/workoutRepository.ts`
