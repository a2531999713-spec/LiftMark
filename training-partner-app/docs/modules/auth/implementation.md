# Auth 模块实现

更新时间：2026-06-29

## 1. API 接入

- `POST /auth/login`
- `POST /auth/login-with-code`
- `POST /auth/send-code`
- `POST /auth/register`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

API base URL 来自 `src/config/api.ts` / `EXPO_PUBLIC_API_BASE_URL`，当前公网开发地址为 `http://47.100.239.29/api`。

当前移动端 UI 调用短信验证码登录 / 注册一体路径：

- `POST /auth/send-code`
- `POST /auth/login-with-code`

`POST /auth/login` 和 `POST /auth/register` 保留在 service/store 层兼容后端，但当前移动端 UI 不暴露为主流程。`POST /auth/login-with-code` 对新手机号执行自动创建账号。

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
