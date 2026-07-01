# Auth 模块实现

更新时间：2026-07-01

## 1. API 接入

- `POST /auth/login`
- `POST /auth/password/login`
- `POST /auth/login-with-code`
- `POST /auth/send-code`
- `POST /auth/register`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

API base URL 来自 `src/config/api.ts` / `EXPO_PUBLIC_API_BASE_URL`，当前公网开发地址为 `http://47.100.239.29/api`。

当前移动端 UI 暴露两种登录路径：

- 密码登录：手机号 / 练刻 ID + 密码，调用 `POST /auth/password/login`，请求体为 `{ identifier, password }`。
- 短信验证码登录 / 注册：手机号 + 验证码，调用 `POST /auth/send-code` 与 `POST /auth/login-with-code`。

`POST /auth/login` 保留为旧客户端兼容接口，继续接受 `{ account, password }`。`POST /auth/register` 保留为显式注册接口；`POST /auth/login-with-code` 对新手机号执行自动创建账号。移动端不信任客户端注册时间，后端在创建用户事务中写入注册顺序和活动字段。

后端用户注册元数据：

- `registration_seq`：PostgreSQL sequence 生成的全局注册序号。
- `registered_at`：服务端时间。
- `registration_source`：默认 `app`，验证码自动创建账号默认 `sms_login`。
- `campaign_code`：可选活动码，规范化为大写。
- `early_user_tier`：前 100 位用户为 `founding_100`，活动码可进入活动分层。

网络请求由 `src/services/httpClient.ts` 统一进入，底层复用 `src/services/apiClient.ts`：

- 默认超时 `API_REQUEST_TIMEOUT_MS = 10000`。
- `fetch failed`、`ConnectException`、`Failed to connect`、`Network request failed` 会转换为“服务器连接失败，请检查网络或稍后再试。”。
- 验证码接口 404 显示“验证码服务正在配置中，请稍后再试。”。
- 验证码接口 5xx 显示“验证码发送失败，请稍后再试。”。
- 用户界面不得展示服务器 IP、Java 异常、stack trace 或原始 fetch 错误。
- `/api/health` 当前公网检查地址为 `http://47.100.239.29/api/health`。

## 2. Token 存储

- 使用 `expo-secure-store`。
- Key：`liftmark.auth.session.v1`。
- 不把 token 写入页面组件，不写入训练表，不写入 AsyncStorage。

## 3. 权限实现

- 入口函数：`decideFeatureAccess(feature, context)`。
- 页面 hook：`useAuthGate()`。
- 页面只负责调用 `guardFeature()`，具体登录、免费版、Pro、限制和开发中规则在 domain 层维护。
- `app/_layout.tsx` 根据 `authStatus` 做主路由保护：
  - `checking`：显示启动加载态。
  - `unauthenticated`：跳转 `/account/login`。
  - `authenticated`：允许进入 `/(tabs)`。
  - `offline_authenticated`：允许进入 `/(tabs)`，首页显示“当前离线，已进入本机模式”。
- `refreshToken` 遇到网络、超时或 5xx 不清空 SecureStore session；只有明确鉴权失败才清除 session。

## 4. 当前限制

- 本机数据绑定到账号尚未实现。
- 完整自动云同步队列尚未实现。
- 真实支付尚未实现。

## 5. 2026-07-01 同步记录

- 登录页密码入口改为手机号 / 练刻 ID + 密码，并增加密码显示切换。
- 短信验证码入口承担注册和找回路径，页面文案改为“验证码注册 / 找回”。
- 后端新增 `POST /auth/password/login`，旧 `POST /auth/login` 继续兼容。
