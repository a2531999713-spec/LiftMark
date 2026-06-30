# 编译打包手册

更新时间：2026-06-28

## 项目信息

| 项 | 值 |
|---|---|
| 包名 | `com.liftmark.app` |
| 版本 | `0.1.0` |
| React Native | 0.85.3 |
| Expo SDK | 56 |
| New Architecture | 已启用 |
| Hermes | 已启用 |
| JS 引擎 | Hermes |
| 签名 | 当前使用 debug keystore（发布前需替换） |

## 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | >= 22.13.0 |
| JDK | 17（Android Studio 自带） |
| Android SDK | compileSdk 35，minSdk 24，targetSdk 35 |
| NDK | 由 React Native Gradle Plugin 管理 |
| Gradle | 9.3.1（项目自带 wrapper） |
| ADB | Android SDK Platform Tools |

SDK 路径：`C:\Users\zhw\AppData\Local\Android\Sdk`（见 `android/local.properties`）

## 一、Android Studio 编译运行

### 1.1 打开项目

Android Studio → **Open** → 选择目录：

```text
C:\Users\zhw\Documents\LiftMark\training-partner-app\android
```

> 不要打开根目录 `training-partner-app`，只打开 `android` 子目录。

### 1.2 安装依赖

在项目根目录（不是 android 目录）执行：

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm install
```

### 1.3 Debug 模式（开发调试）

Debug 模式下 Android Studio 只编译原生壳，JS 由 Metro Dev Server 提供。

**步骤 1** — 启动 Metro：

```powershell
npm run start:dev-client
```

**步骤 2** — Android Studio 中：

```text
Build Variants → app → debug
Run → app (Shift+F10)
```

**步骤 3** — 应用安装后，在项目根目录执行：

```powershell
npm run android:studio:open
```

该命令会：
- 执行 `adb reverse tcp:8081 tcp:8081`
- 设置 React Native debug host 为 `localhost:8081`
- 通过深链打开 Metro 项目

### 1.4 Release 预览模式（不依赖 Metro）

切换 Build Variants → app → **release**，然后 Run → app。

或者命令行：

```powershell
npm run android:preview
```

此命令会依次执行：打包 release APK → 安装到设备 → 启动应用。

---

## 二、小米手机编译运行

小米手机通过 USB 连接，需要开启 **USB 调试**。

### 2.1 开启 USB 调试

1. 小米手机 → 设置 → **我的设备** → **全部参数与信息**
2. 连续点击 **MIUI 版本** 7 次，开启开发者模式
3. 设置 → **更多设置** → **开发者选项**
4. 开启 **USB 调试**
5. USB 连接模式选择 **文件传输（MTP）**

### 2.2 确认设备连接

```powershell
adb devices -l
```

应看到类似输出：

```text
ef3a4a2   device product:shennong model:23116PN5BC device:shennong
```

如果有多个设备，后续命令需要指定设备序列号：

```powershell
adb -s ef3a4a2 <command>
```

### 2.3 Debug 编译安装到小米手机

**方法 A — Android Studio：**

```text
Build Variants → app → debug
Run → app
选择小米设备作为部署目标
```

**方法 B — 命令行：**

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app\android
.\gradlew.bat :app:installDebug -PreactNativeArchitectures=arm64-v8a
.\gradlew.bat :app:installDebug -PreactNativeArchitectures=x86_64
```

> `arm64-v8a` 适用于小米手机真机（ARM64 架构）。
> `x86_64` 适用于模拟器。

安装后启动 Metro 并建立连接：

```powershell
npm run start:dev-client
# 新终端
npm run android:studio:open
```

### 2.4 Release 编译安装到小米手机

**一步到位（打包 + 安装 + 启动）：**

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
npm run android:preview
```

**分步执行：**

```powershell
# 1. 打包 release APK（arm64 架构）
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

# 2. 安装到小米手机
adb install -r app\build\outputs\apk\release\app-release.apk

# 3. 启动应用
adb shell monkey -p com.liftmark.app -c android.intent.category.LAUNCHER 1
```

如果连接了多台设备：

```powershell
adb -s <设备序列号> install -r app\build\outputs\apk\release\app-release.apk
adb -s <设备序列号> shell monkey -p com.liftmark.app -c android.intent.category.LAUNCHER 1
```

---

## 三、编译发行版与测试版

### 3.1 版本区分

| 变体 | Build Type | 用途 | 签名 |
|---|---|---|---|
| debug | Debug | 开发调试，连接 Metro | debug.keystore |
| release | Release | 本地预览/测试 | debug.keystore（临时） |
| release（正式） | Release | 发布上架 | 需要正式签名证书 |

### 3.2 编译 Debug 版本

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app\android
.\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

输出路径：

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

### 3.3 编译 Release 版本（测试用）

当前 Release 版本使用 debug keystore 签名，仅用于本地测试，不能上架应用商店。

**全架构（兼容所有设备）：**

```powershell
.\gradlew.bat assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

**仅小米手机（ARM64）：**

```powershell
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

**仅模拟器（x86_64）：**

```powershell
.\gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64
```

输出路径：

```text
android\app\build\outputs\apk\release\app-release.apk
```

### 3.4 编译正式发行版

正式发行版需要替换签名证书。步骤：

**步骤 1** — 生成签名 keystore：

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore android\app\release-key.keystore -alias liftmark -keyalg RSA -keysize 2048 -validity 10000
```

按提示输入密码和信息。**此 keystore 文件务必妥善保管，丢失将无法更新已发布的应用。**

**步骤 2** — 在 `android/app/build.gradle` 中添加 release 签名配置：

```groovy
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('release-key.keystore')
        storePassword '你的密码'
        keyAlias 'liftmark'
        keyPassword '你的密码'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ...
    }
}
```

> 建议将密码移到 `gradle.properties` 或环境变量中，不要硬编码在源码里。

**步骤 3** — 编译正式 Release APK：

```powershell
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

输出路径：

```text
android\app\build\outputs\apk\release\app-release.apk
```

### 3.5 开启代码压缩（可选）

在 `gradle.properties` 中设置：

```properties
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

这会启用 R8 代码压缩和资源压缩，减小 APK 体积。首次编译会更慢。

---

## 四、常用命令速查

| 命令 | 说明 |
|---|---|
| `npm run start:dev-client` | 启动 Metro Dev Server |
| `npm run android:preview` | 打包 release + 安装 + 启动（一步到位） |
| `npm run android:apk:device` | 编译 arm64 release APK |
| `npm run android:apk` | 编译 x86_64 release APK |
| `npm run android:apk:universal` | 编译全架构 release APK |
| `npm run android:apk:install` | 编译 + 安装 x86_64 release |
| `npm run android:install` | 安装已有的 release APK |
| `npm run android:open` | 启动已安装的应用 |
| `npm run android:apk:clean` | 清理原生缓存后重新编译 |
| `npm run android:clear` | 清除 Metro 缓存 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 检查 |

---

## 五、常见问题

### APK 体积过大

Release 构建默认包含 4 种 CPU 架构。只打包目标设备的架构：

```powershell
# 小米手机只需要 arm64
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

或开启代码压缩（见 3.5 节）。

### 编译失败：`CMake` 或 `NDK` 错误

```powershell
cd android
.\gradlew.bat clean
cd ..
npm run android:apk:clean
```

### 编译失败：`NODE_ENV` 警告

这是 `expo-constants` 插件的非致命警告，不影响编译结果，可忽略。

### 多设备时安装失败

```powershell
adb devices -l
adb -s <目标设备序列号> install -r app\app\build\outputs\apk\release\app-release.apk
```

### 签名不一致无法覆盖安装

卸载旧版本后重新安装：

```powershell
adb uninstall com.liftmark.app
adb install app\build\outputs\apk\release\app-release.apk
```
