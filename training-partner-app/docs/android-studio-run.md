# Android Studio 编译运行说明

更新时间：2026-06-24

## 结论

当前 Android 原生工程可以用 Android Studio 编译运行。需要区分两种模式：

- Debug / development build：Android Studio 只编译并启动原生壳，JS 由 Metro 提供，需要先启动 `npm run start:dev-client`。
- Release 预览 APK：JS bundle 会被打进 APK，不依赖 Metro，更接近当前 `npm run android:preview` 的验收方式。

## 必须打开的目录

Android Studio 请选择打开：

```text
C:\Users\zhw\Documents\LiftMark\training-partner-app\android
```

不要把 `training-partner-app` 根目录当作 Android Studio 工程打开。

## Debug 模式运行

适合日常开发调试。

1. 在项目根目录安装依赖：

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm install
```

2. 启动 Expo Dev Client 的 Metro：

```powershell
npm run start:dev-client
```

3. 在 Android Studio 中：

```text
Open -> C:\Users\zhw\Documents\LiftMark\training-partner-app\android
Build Variants -> app / debug
Run -> app
```

4. Android Studio 安装并启动 debug 包后，在项目根目录执行：

```powershell
npm run android:studio:open
```

该命令会执行：

- `adb reverse tcp:8081 tcp:8081`
- 将 React Native debug host 设置为 `localhost:8081`
- 通过 `liftmark://expo-development-client/?url=...` 深链打开当前 Metro 项目

如果停在 Expo Dev Launcher 页面，可以再次执行：

```powershell
npm run android:studio:open
```

## Release 预览模式运行

适合不依赖 Metro 的本地验收。

命令行推荐：

```powershell
npm run android:preview
```

Android Studio 中也可以切换 Build Variants 到 `release` 后运行 `app`。当前 release 预览包使用 debug keystore 签名，仅用于本地预览，不能作为正式发布包。

## 常见问题

### 停在 Expo Dev Launcher

这是 debug 模式的正常行为。Android Studio 只负责启动原生壳，不会自动选择 Metro 项目。执行：

```powershell
npm run android:studio:open
```

### 日志出现 `10.0.2.2:8081` 连接失败

当前模拟器可能不能访问 host alias `10.0.2.2`。执行：

```powershell
npm run android:studio:open
```

脚本会改用 `localhost:8081` + `adb reverse`。

### `run-as com.liftmark.app` 失败

先在 Android Studio 用 debug 变体运行一次，确保 debug 包已经安装。release 包不可用于这个 debug host 配置脚本。

### Native / CMake 缓存异常

优先执行：

```powershell
npm run android:apk:clean
```

不要修改 `node_modules`。

## 已验证命令

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app\android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64
.\gradlew.bat :app:installDebug -PreactNativeArchitectures=x86_64
```

两条命令已在本机模拟器 `emulator-5554` 上通过。

## 业务边界

Android Studio 运行方式只影响本地开发调试。不会改变训练保存逻辑，不会让训练现场依赖联网，也不会修改 SQLite schema。
