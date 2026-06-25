# Auth 模块概览

更新时间：2026-06-24

## 1. 模块职责

- 管理手机号验证码登录 / 注册、token 恢复、退出登录和当前用户状态。
- 派生 `checking / unauthenticated / authenticated / offline_authenticated` 启动状态，以及 `logged_in_free / logged_in_pro / logged_in_lifetime` 权益状态。
- 为页面提供统一访问控制，不在页面中散写会员和登录规则。

## 2. 非职责

- 不保存训练记录。
- 不修改本地 SQLite schema。
- 不要求训练现场联网。
- 不直接调用阿里云、支付渠道或第三方云服务。

## 3. 主要文件

| 文件 | 说明 |
|---|---|
| `src/services/auth/*` | 后端认证 API、SecureStore token 存储和刷新。 |
| `src/store/authStore.ts` | 当前用户、登录状态、会员等级、auth mode 和登录动作。 |
| `src/domain/auth/*` | Feature 访问控制、会员层级和退出本地数据策略。 |
| `src/components/auth/*` | 登录要求、Pro 要求、云同步提示弹层。 |
| `src/hooks/useAuthGate.ts` | 页面调用的统一权限 gate。 |

## 4. 当前边界

- 首次使用必须完成手机号验证码登录 / 注册，未登录不能进入主 Tab。
- 服务器不可用时，已存 session 可离线保留并进入本机模式；不会清空 session 或 SQLite。
- 离线进入时不主动拉取云端完整资料，不做全量同步或云端恢复。
- 云同步入口可测试，完整自动同步队列后续接入。
