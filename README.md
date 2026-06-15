# 练刻 LiftMark

练刻 LiftMark 是一个 Android 优先的力量训练 App，用来执行训练计划、记录每一组训练，并把持续进步沉淀成本地数据。

当前项目采用 Expo / React Native / TypeScript / Expo SQLite，本地数据优先，核心训练记录写入 SQLite。第一版聚焦训练闭环：

```text
动作库 -> 计划管理 -> 今日训练 -> 训练执行 -> 训练记录 -> 趋势分析
```

## 项目结构

```text
training-partner-app/
  app/                 Expo Router 页面
  src/domain/          UI 无关的领域逻辑
  src/data/            Repository 接口与 SQLite 实现
  src/components/      复用组件与 UI 组件
  src/services/        导入、导出等应用服务
  src/tests/           Jest 单元测试
  docs/                产品、架构、模块与交接文档
```

## 当前能力

- 本地小组和成员管理
- 系统训练方案复制为“我的计划”
- 用户计划创建、导入、切换和删除
- 动作库和自定义动作
- 今日训练和训练执行
- SQLite 训练记录、历史详情和补录
- 个人记录数据页和训练趋势分析
- 小组记录接口预留

## 运行与验收

真实项目路径：

```powershell
cd C:\Users\zhw\Documents\LiftMark\training-partner-app
```

常用命令：

```powershell
npm run typecheck
npm run lint
npm test
npm run android:preview
```

当前 Android package：

```text
com.liftmark.app
```

## 开发原则

- 训练记录必须保存到 SQLite，不使用 AsyncStorage。
- 系统方案只读，用户必须复制为“我的计划”后才能执行。
- 训练记录不能直接绑定系统方案，应绑定用户计划或训练时快照。
- 计划和动作库是数据，不硬编码在 React 页面组件里。
- Domain 层不依赖 UI，Repository 层保留未来云同步边界。
- 当前不包含登录、云同步、饮食模块、动作 GIF / 视频。
