# 术语表

更新时间：2026-06-30

| 术语 | 含义 | 相关模块 |
|---|---|---|
| 计划模板 | 定义阶段、周、训练日、动作、组数、次数和强度的数据模板 | plan |
| 个人参数 | 成员自己的 1RM、体重、加重单位等数据 | member, weight |
| 训练记录 | 某次实际训练的 session、动作记录和 set 记录 | workout, history |
| 1RM | 一次最大重量，用于百分比重量计算 | member, weight |
| 双进阶 | 先把次数推进到上限，再增加重量 | progression |
| 减量周 | 降低重量和组数用于恢复疲劳的周期 | plan, recovery |
| A/B/C 优先级 | A 必做，B 建议做，C 状态好/有时间再做 | plan, recovery |
| 动作筛选 | 今日训练创建 session 前对 A/B/C 动作做本次过滤：完整动作、精简辅助、只做主项或今日休息 | today-training, workout, recovery |
| 替代动作 | 器械被占或身体不适时保持动作模式的替换动作 | exercise |
| 替换动作记录 | 本次训练实际执行动作与原计划动作的关系，保存于 `workout_exercise_records.exercise_id` 和 `replaced_from_exercise_id` | workout, history |
| 当前小组 | 用户当前正在查看和创建训练记录的本地小组，由 `selectedGroupStore` 保存轻量状态 | group, workout, history |
| 身体目标 | 身体数据模块中的增肌、减脂或维持目标，可选目标体重和目标日期 | body-metrics |
| 实际休息时间 | 完成一组后到继续下一组之间记录的秒数，保存为 `actual_rest_seconds` | workout |
| seed 数据 | 首次启动写入 SQLite 的默认计划、动作和替换库 | plan, exercise |
| Repository | Domain/UI 访问本地 SQLite 的抽象接口 | api, database |
| 云端优先 + 本地缓存 | 训练数据先写 SQLite，离线也能完整训练 | technical-architecture |
| AsyncStorage | 只允许保存轻量设置，不允许保存训练记录 | technical-architecture |
| 计划快照 | 训练记录保存当时计划字段，防止计划修改破坏历史 | workout, history |
| 进阶建议 | 完成训练后生成下次加重、维持、降重、减量或继续加次数建议 | progression |
| 主流计划库 | 当前系统提供的可复制训练方案目录，不包含 legacy 旧默认方案 | plan, onboarding |
| 推荐计划 | 根据训练目标、频率、经验和器械条件推荐的系统方案，使用前必须复制为用户计划 | onboarding, plan |
| Legacy 计划 | 为兼容旧训练记录和旧默认 ID 保留的数据，不作为新用户入口展示 | plan, database |
