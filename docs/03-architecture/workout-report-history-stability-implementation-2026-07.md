# v2.7.1：训练结束、报告、记录中心与云端个人记录稳定性修复

## 目标

修复训练结束被单组完成误触发、训练报告字段不匹配、记录中心缺少趋势和分析入口、手动补录模式歧义、稀疏柱图不可读，以及 fullPull 后个人历史因成员标识不一致而不可见的问题。

## 数据与边界

- 训练结束的关键路径仅包含本地防抖写入 flush、autosave flush 和 SQLite `finishSession`；摘要页先跳转，sync 只在后台触发。
- 报告继续以 `owner_user_id + group_id + session_id` 查询。持久化字段使用 `estimated_calories_min` / `estimated_calories_max`；没有报告的旧训练只读回退到 session 与 sets 汇总，不回写历史数据。
- 个人历史仍按当前账号、小组和当前成员读取。pull 后的成员引用修复只在同一账号、同一小组内，将精确匹配 `group_members.local_member_id` 或 `remote_id` 的旧值改为本地 member id；不按 `user_id` 猜测，也不修改没有 group scope 的 body metrics。

## 交互约束

- “完成本组”只保存当前 set；最后一个动作结束由独立完成卡片显式触发。
- 记录中心保留个人/小组、周期/自由/补录、日期和报告入口，并恢复数据驱动的趋势说明及分析入口。
- 手动补录不再展示个人/多人切换；参与人数为 0 时禁止提交，1 人为 solo，2 人及以上为 group。
- 调整面板一次只执行一个操作，应用中禁用重复点击；动作选择列表在训练页生命周期内缓存。

## 数据库与部署

本次不新增 SQLite migration，不修改 PostgreSQL、API 或同步协议，不需要服务器部署。

## 验证

- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- 真机仍需在隔离测试账号完成训练、结束、报告、记录中心与 fullPull 验收；不得使用 176 的真实数据做写入验证。
