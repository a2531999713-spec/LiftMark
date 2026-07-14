# 训练提醒设置与本地通知实现（v2.6.0）

## 范围

入口为“我的 → 训练偏好 → 训练提醒”。用户可以选择当前计划训练日、开始时间以及提前 30 分钟、提前 10 分钟、当天计划三类提醒，并发送测试通知。

## 数据边界

业务配置复用 `training_reminders`，必须带 `owner_user_id`、`group_id`、`plan_id`、`plan_cycle_id`、`weekday`、`remind_time`、`minutes_before`、`timezone` 和 `enabled`。同步 registry 已注册这些业务字段。

SQLite v24 新增 `notification_ids_json`。它仅保存当前设备的 Expo notification identifier，不进入 registry、队列或服务器 payload，因此云恢复后由当前设备重新调度。

## 生命周期

保存时读取当前账号/小组提醒，取消其中保存的 ID，写入最新业务记录，创建新调度并保存 ID/`last_scheduled_at`。关闭、计划周期完成或归档、登出、账号切换均只取消该账号提醒持有的 ID；应用启动后的恢复会为有效的活动周期重建缺失调度。禁止全量取消设备通知。

## 跳转和降级

根布局只注册一个通知响应 listener，前台和冷启动点击都转至今日训练页。payload 即使关联计划已经删除、归档或不可见，也安全降级到普通今日页。

## 验证

自动化覆盖星期映射、跨日前置时间、Repository 账号/小组与软删除作用域、设备 ID 元数据，以及重复保存先取消旧调度。还需在 Android 真机验证权限、测试通知、通知点击、修改时间、关闭和重启恢复。
