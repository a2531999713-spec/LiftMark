# Activation 模块设计

更新时间：2026-06-12

## 1. 状态模型

历史本地激活状态字段仍保留用于兼容：

- `isActivated`
- `activationCode`
- `activatedAt`
- `trialStartedAt`
- `trialExpiresAt`
- `deviceId`
- `appVersion`

## 2. 页面设计

当前用户可见激活页包含：

- 登录状态；
- 当前账号；
- 激活码输入框；
- 兑换按钮；
- 权益以后端会员记录为准的说明。

“我的 / 会员与激活”进入激活码兑换页。不再使用“本地激活”命名。

## 3. 校验策略

第一版用户可见兑换调用后端 `/api/activation-codes/redeem`。激活码明文只在后台创建时返回一次，数据库保存哈希。
