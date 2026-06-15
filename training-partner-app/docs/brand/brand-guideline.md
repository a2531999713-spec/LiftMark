# 练刻 LiftMark 品牌规范

更新时间：2026-06-14

## 品牌命名

- 中文名：练刻
- 英文名：LiftMark
- 完整品牌：练刻 LiftMark
- 品牌定位：你的力量训练计划执行器，记录每次训练，刻下持续进步。

## 命名边界

- 用户可见品牌统一使用“练刻”或“练刻 LiftMark”。
- 英文项目名、npm package、slug、scheme 使用 `liftmark` / `LiftMark`。
- Android package / applicationId 使用 `com.liftmark.app`。
- 已废弃旧品牌 `LiftOn`、`lifton`、`开练`、`WhatLift`、`今天练啥` 不再用于当前 UI、配置、源码语义名或导出格式。
- 当前真实项目路径为 `C:\Users\zhw\Documents\LiftMark\training-partner-app`。

## 品牌色

| Token | 颜色 | 用途 |
|---|---|---|
| Ink Navy | `#0D1B2A` | 品牌深色、图标背景、沉浸训练页 |
| Coral Red | `#FF5A4D` | 主按钮、关键状态、进度强调 |
| Light Gray | `#F2F4F7` | 页面背景、轻量容器背景 |
| White | `#FFFFFF` | 卡片、深色背景上的文字 |

## 资源位置

| 资源 | 路径 | 用途 |
|---|---|---|
| App icon | `training-partner-app/assets/brand/app-icon-1024.png` | Expo 和 Android 应用图标源 |
| Adaptive foreground | `training-partner-app/assets/brand/adaptive-icon-foreground.png` | Android adaptive icon 前景 |
| Monochrome icon | `training-partner-app/assets/brand/adaptive-icon-monochrome.png` | Android themed icon 单色前景 |
| Splash logo | `training-partner-app/assets/brand/splash-logo.png` | 启动页 logo |
| Favicon | `training-partner-app/assets/brand/favicon.png` | Web 预留 favicon |
| 页面品牌图 | `training-partner-app/src/assets/brand/` | React Native 页面内品牌展示 |
| 原始素材 | `training-partner-app/assets/brand/source/` | 用户提供的 5 张品牌源图 |

## 使用规则

- 页面组件通过 `src/assets/brand/index.ts` 引用品牌图片，不直接引用源文件名。
- 训练氛围图通过 `src/assets/images/index.ts` 的 `liftmarkImages` 引用。
- 不把品牌图片硬编码进业务逻辑或数据库 seed。
- 不使用第三方品牌、图标或版权不明素材作为练刻主视觉。

## 导出格式

- 计划文件第一版使用 `.liftmark.json`。
- manifest 中必须包含 `app: "LiftMark"`、`format: "liftmark-plan"`、`schemaVersion: 1`。
- 计划文件不包含成员 1RM、身体数据或训练记录。
