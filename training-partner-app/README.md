# 练刻 LiftMark

多人健身训练 App 的 Expo + React Native + TypeScript 项目。

## Scripts

```bash
npm run start
npm run android
npm run android:preview
npm run typecheck
npm run lint
npm test
```

## 当前验收方式

第一阶段以 Android 本地 APK 预览为主要验收方式：

```powershell
npm run android:preview
```

该命令会编译 APK、安装到已连接的 Android 设备或模拟器，并尝试自动打开 App。

## 工程约束

- SQLite 是 Android / iOS 的本地数据存储方案。
- 训练计划必须作为 seed 数据进入数据库。
- 不要把训练计划写死到 React 组件中。
- 不要用 AsyncStorage 保存训练记录。
