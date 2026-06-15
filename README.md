<div align="center">

# 练刻 LiftMark

**你的智能健身训练伙伴**

[![Expo](https://img.shields.io/badge/Expo-56-000000?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB?style=for-the-badge&logo=reactnative&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<img src="training-partner-app/assets/brand/brand-preview.png" alt="LiftMark Preview" width="100%">

</div>

---

## ✨ 功能特性

- 🏋️ **多人训练管理** - 支持多个团队成员，各自独立的训练计划
- 📊 **智能训练计划** - 系统化的力量训练和增肌计划
- 📈 **渐进式超负荷** - 自动记录和推荐重量递增
- 💪 **训练记录** - 详细记录每次训练的组数、次数、重量
- 📅 **历史分析** - 查看训练历史和进步趋势
- 🔄 **数据导入导出** - 支持训练数据和计划的导入导出

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Expo 56** | 跨平台开发框架 |
| **React Native 0.85** | 移动端 UI 框架 |
| **TypeScript 6.0** | 类型安全的 JavaScript |
| **Expo Router** | 文件系统路由 |
| **SQLite** | 本地数据存储 |
| **Zustand** | 状态管理 |
| **React Hook Form** | 表单处理 |
| **Zod** | 数据验证 |

## 🚀 快速开始

### 环境要求

- Node.js >= 22.13.0
- npm 或 yarn
- Android Studio (Android 开发)
- Expo CLI

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/a2531999713-spec/LiftMark.git

# 进入项目目录
cd -/training-partner-app

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 运行应用

```bash
# Android 设备/模拟器
npm run android

# 构建 APK 预览版
npm run android:preview

# iOS 设备/模拟器
npm run ios

# Web 浏览器
npm run web
```

## 📁 项目结构

```
training-partner-app/
├── app/                    # Expo Router 页面
│   ├── (tabs)/            # 标签页路由
│   │   ├── today.tsx      # 今日训练
│   │   ├── plan.tsx       # 训练计划
│   │   ├── history.tsx    # 训练历史
│   │   ├── members.tsx    # 成员管理
│   │   └── settings.tsx   # 设置
│   ├── workout/           # 训练相关页面
│   ├── plan/              # 计划相关页面
│   └── member/            # 成员相关页面
├── src/                   # 源代码
│   ├── components/        # UI 组件
│   ├── domain/            # 业务逻辑
│   ├── data/              # 数据层
│   ├── services/          # 服务层
│   └── theme/             # 主题配置
├── assets/                # 静态资源
├── scripts/               # 构建脚本
└── docs/                  # 文档
```

## 📜 可用脚本

| 命令 | 描述 |
|------|------|
| `npm start` | 启动 Expo 开发服务器 |
| `npm run android` | 运行 Android 应用 |
| `npm run android:preview` | 构建并安装 APK |
| `npm run android:release` | 构建 Release 版本 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm test` | 运行测试用例 |

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- GitHub: [@a2531999713-spec](https://github.com/a2531999713-spec)
- Email: a2531999713@163.com

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

</div>
