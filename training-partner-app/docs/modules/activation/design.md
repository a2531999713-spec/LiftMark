# Activation 模块设计

更新时间：2026-06-12

## 1. 状态模型

本地激活状态字段：

- `isActivated`
- `activationCode`
- `activatedAt`
- `trialStartedAt`
- `trialExpiresAt`
- `deviceId`
- `appVersion`

## 2. 页面设计

激活页包含：

- 当前激活状态；
- 试用剩余时间；
- 设备 ID；
- 激活码输入框；
- 激活按钮；
- 试用说明。

设置页从“试用与激活”卡片进入激活页。

## 3. 校验策略

第一版只做本地白名单校验。当前测试码：

```text
LIFTMARK-TEST-2026
```

后续远程校验接入时，保持 Domain service 不依赖 UI。
