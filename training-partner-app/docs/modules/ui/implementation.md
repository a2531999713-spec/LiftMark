# UI 模块实现

更新时间�?026-06-14

## 代码位置

| 文件/目录 | 说明 |
|---|---|
| `training-partner-app/src/theme/` | 颜色、间距、字号、圆角和阴影 token�?|
| `training-partner-app/src/components/ui/` | 可复用基础 UI 组件�?|
| `training-partner-app/src/assets/images/index.ts` | 训练氛围图语义映射，页面通过 `liftmarkImages` 引用�?|
| `training-partner-app/src/assets/brand/index.ts` | 页面内品牌图语义映射，页面通过 `liftmarkBrandAssets` 引用�?|
| `training-partner-app/assets/brand/` | Expo app icon、adaptive icon、splash、favicon 和源图�?|
| `training-partner-app/android/app/src/main/res/` | Android 原生图标、adaptive icon layer、splash logo 和颜色�?|
| `training-partner-app/app/about.tsx` | 关于练刻页面，展示关于练刻、意见反馈、用户协议、隐私政策和版本号�?|
| `training-partner-app/app/account/login.tsx` | 账号密码登录 + 验证码注册页，支持手机号/邮箱/练刻账号登录，包含协议勾选、验证码发送、倒计时和中文错误提示�?|
| `training-partner-app/app/(tabs)/settings.tsx` | “我的”页，展示深色账号主卡、四个主入口、关于练刻和退出登录�?|
| `training-partner-app/src/components/avatar/` | 账号头像展示和可编辑头像组件�?|
| `training-partner-app/src/components/auth/AuthRequiredSheet.tsx` | 登录要求弹窗，只保留登录 / 注册主按钮，不提供关闭后浏览�?|

## 当前资源清单

| 资源 | 路径 |
|---|---|
| App icon | `assets/brand/app-icon-1024.png` |
| Adaptive foreground | `assets/brand/adaptive-icon-foreground.png` |
| Adaptive monochrome | `assets/brand/adaptive-icon-monochrome.png` |
| Splash logo | `assets/brand/splash-logo.png` |
| Favicon | `assets/brand/favicon.png` |
| 页面�?logo | `src/assets/brand/logo-primary.png` |
| Wordmark | `src/assets/brand/logo-wordmark.png` |
| Brand mark | `src/assets/brand/brand-mark.png` |
| Brand preview | `src/assets/brand/brand-preview.png` |
| 探索训练�?| `src/assets/images/liftmark-hero-deadlift.png` |
| 搭子训练�?| `src/assets/images/liftmark-partner-bench.png` |
| 计划训练�?| `src/assets/images/liftmark-plan-review.png` |
| 记录/恢复训练�?| `src/assets/images/liftmark-recovery.png` |
| 训练执行�?| `src/assets/images/liftmark-training-bench.png` |

## 本次品牌迁移

- Expo `app.json` 已切换为 `name: "练刻"`、`slug: "liftmark"`、`scheme: "liftmark"`�?
- Android `namespace` / `applicationId` 已切换为 `com.liftmark.app`�?
- `package.json` �?`android:open` 使用 `adb shell monkey -p com.liftmark.app -c android.intent.category.LAUNCHER 1`�?
- Android Kotlin 文件已移动到 `android/app/src/main/java/com/liftmark/app/`�?
- 设置页新增“品牌与版本”卡片和“关于练刻”入口�?

## 验证重点

- APK 安装后桌面名称显示“练刻”�?
- `npm run android:preview` 可以编译、安装并打开 `com.liftmark.app`�?
- 设置页显示“练�?LiftMark”�?
- 启动页和应用图标使用新的 LiftMark 资源�?
- 训练页面仍通过 `liftmarkImages` 渲染本地训练图，不影�?SQLite、seed 和训练记录�?
