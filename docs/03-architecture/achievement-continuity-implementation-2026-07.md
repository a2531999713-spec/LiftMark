# LiftMark v2.11.0 训练连续性与成就中心实现

日期：2026-07-21

## 1. 产品目标

从用户已经保存的训练事实生成可离线、可恢复、无竞争压力的阶段里程碑。成就不是积分、付费权益、排行榜、医疗评价或每日强制打卡。

## 2. 成就目录

| code | 名称 | metric | target |
|---|---|---|---:|
| `first_workout` | 首次完成训练 | `completed_workouts` | 1 |
| `workouts_10` | 稳定起步 | `completed_workouts` | 10 |
| `workouts_25` | 形成节奏 | `completed_workouts` | 25 |
| `workouts_50` | 坚持训练 | `completed_workouts` | 50 |
| `active_week_streak_3` | 连续训练 3 周 | `longest_active_week_streak` | 3 |
| `active_week_streak_8` | 训练成为习惯 | `longest_active_week_streak` | 8 |
| `volume_10000` | 累计训练量 1 万公斤 | `total_volume` | 10000 |
| `volume_50000` | 累计训练量 5 万公斤 | `total_volume` | 50000 |
| `first_group_workout` | 第一次一起练 | `group_workouts` | 1 |
| `cycle_complete_1` | 完成一个计划周期 | `completed_cycles` | 1 |
| `recovery_checkins_7` | 关注训练状态 | `recovery_checkins` | 7 |

稳定 code、metric、target 和 DTO 定义位于 `packages/shared`。移动端补充图标与排序展示，不在页面硬编码业务阈值。

## 3. 废弃连续训练天数的原因

`streak_3_days` 容易把力量训练误导为连续多日打卡。seed 将它设为 `enabled = false`，不删除 definition 和已有 `user_achievements`。连续性改为活跃自然周；旧错误别名 `ten_workouts` 同样禁用以避免重复展示，但历史行仍保留。

## 4. 有效训练口径

有效 session 同时满足：

- 当前账号范围；
- `deleted_at IS NULL`；
- status 为 `completed`；
- 至少包含一组有效完成 set。

有效 set 同时满足 completed、非 skipped、未软删除。draft、in_progress、cancelled、已删除或没有有效组的 session 均不计数；一个 session 无论多少组只算一次训练。

## 5. 训练容量口径

只累计有效 session 下的有效 set，公式为 `weight * reps`。重量优先 actual 后 planned，次数优先 actual 后 planned，规范列与 payload 统一解析；null、NaN、负数和异常大值经过安全转换。自重 0 kg 不贡献容量，但仍可让 session 成为有效训练。

## 6. 活跃周计算

日期以 `YYYY-MM-DD` civil date 直接计算 Monday week key，不先转换本地时区或 UTC 时间点。一个周一至周日自然周至少一场有效训练即为活跃周，同周多场只形成一个周键。

- 当前周已有训练：从当前周向前连续计数。
- 当前周暂时没有训练：在本周结束前保留以上周为尾部的连续周。
- 上一个完整自然周缺失：current streak 为 0。
- 任意中间周缺失：longest/current 在缺口处中断。
- 使用 civil-date 运算覆盖跨年周。

## 7. 本地聚合结构

`SQLiteAchievementRepository.getAchievementSnapshot({ ownerUserId, todayKey?, excludeSessionId? })` 并行执行三条固定聚合查询：有效 session/set、完成/归档周期、按 member/date 去重的恢复记录。随后在内存计算指标、11 项进度和最近 12 周。没有逐 session 详情读取或逐 achievement 查询。

## 8. 服务端统计结构

服务端从认证用户取得 `userId`，固定读取该用户的 session、set、cycle、recovery rows，再由纯函数统一解析 generic sync 列与 payload。`training_mode === group_local` 才计小组训练，不能仅凭 `group_id`。周期只计 completed/archived；恢复按 member/date 去重。

## 9. 本地与远端合并

移动端先返回本地快照，再后台请求 API。合并规则：progress/累计指标取最大值，achieved 使用 OR，`achievedAt` 取更早非空时间；current streak、this-week count 与 12 周展示优先本地当前 civil date。远端失败完整保留本地结果，远端恢复不会让进度倒退。

## 10. 成就解锁时序

完成 session 后立即进入 summary。后台分别生成报告、进阶建议、成就 after 快照和同步。成就 before 快照通过排除刚完成 session 得到；差量写入账号级 pending key，summary 消费后展示。任何成就错误都不阻塞完成事务或总结页。

## 11. 首页入口

Today 在核心计划与动作内容之后显示普通卡片高度的“训练连续性”，包含本周次数、连续活跃周和下一里程碑。点击整卡进入 `/achievements`。加载失败仅隐藏/降级该卡，不影响首页其他模块或开始训练。

## 12. 成就中心信息架构

采用图三方向：标题与说明、单张摘要/12 周节奏主卡、下一里程碑、进行中、已解锁和底部说明。进行中按完成比例倒序，已解锁按 `achievedAt` 倒序；未解锁内容不被锁头覆盖。图标使用 Ionicons，不引入图片徽章。

## 13. 离线行为

SQLite 是业务读取入口。无网时可计算完整本地快照并在训练完成后产生新解锁。API 恢复后重新计算并单调合并；`user_achievements` 不加入 generic sync，避免逐行状态冲突。

## 14. API DTO

`GET /api/achievements/me` 返回 camelCase：

```ts
{
  metrics: AchievementMetrics;
  achievements: AchievementProgress[];
  generatedAt: string;
}
```

接口不接受 userId query/body，认证失败不能泄露任何其他用户信息。

## 15. seed 幂等策略

11 项目录按 code upsert，重复运行更新 name/description/metric/target/enabled 而不产生重复行。旧 definition 只禁用，不 delete；seed 不删除 `user_achievements`、不重置 progress 或 `achieved_at`，也不影响系统方案和管理员 seed。

## 16. 账号作用域

本地要求显式 `owner_user_id = currentUserId` 且拒绝不匹配 owner；不读取 null owner，不按昵称认领数据。服务端始终使用 `authUser.id` 的 `user_id` 条件。seen/pending SecureStore key 也包含 userId，切换/退出后 UI 不复用上一账号快照。

## 17. 测试结果

- shared：typecheck/build 通过。
- mobile：typecheck、lint、55 suites / 275 tests 通过。
- API：typecheck/build、递归发现的 23 tests 通过。
- 覆盖引擎边界、有效 session/set、容量、跨年与当前周、账号隔离、merge、N+1 reconcile、首次 achievedAt、API auth/DTO、UI 排序/单位和一次性 Sheet。

## 18. 真机验收

OnePlus NE2210 已安装 arm64 APK并验证：首页卡展示与跳转、成就中心加载、12 周显示、滚动、Android 返回、无横向溢出。出于 176 主账号数据保护，只做只读验收；未制造训练、取消、跳过、小组和断网写入数据，因此解锁 Sheet 的完整写路径仍由自动化覆盖。

## 19. PostgreSQL、API 与部署影响

无 SQLite migration，无 PostgreSQL schema migration。API、shared build 和 seed 有变更，因此合并后需要服务器部署。部署前确认工作区、备份 PostgreSQL、检查 PM2；构建 shared/API、递归跑测试、执行幂等 seed，再按现有 `ecosystem.config.js` reload `liftmark-api` 并验证 health/migration-health/achievements。

## 20. 已知限制

- 不开放公开资料、好友成就、成员成就详情或排行榜。
- 不包含积分、金币、商城、挑战、会员专属目标或个人记录 PR 成就。
- 不把动作图标延期范围带入成就；这里只使用通用界面图标。
- 真机未在隔离账号执行完成训练后的写入验收。

## 21. 下一阶段计划

先完成合并后 API/seed 部署和隔离测试账号验收，再观察指标口径与用户反馈。任何新成就应继续复用稳定 catalog、有效训练事实、账号范围和离线优先链路；本轮之后方可开始新的独立重构任务。
