# UI 模块概览

更新时间：2026-06-14

UI 模块负责“练刻 LiftMark”的移动端视觉系统、基础组件、品牌资源和核心页面布局规范。

## 当前范围

- 底部导航：探索、搭子、训练、计划、记录。
- 基础 UI 组件：`Screen`、`AppText`、`AppCard`、`AppButton`、`SectionHeader`、`Tag`、`MetricCard`、`ActionCard`、`EmptyState`、`SettingsRow`、`DangerZone`、`VisualHeroCard`。
- Theme token：`src/theme/colors.ts`、`spacing.ts`、`typography.ts`、`radius.ts`、`shadows.ts`。
- 品牌资源：`assets/brand/` 和 `src/assets/brand/`。
- 训练氛围图：`src/assets/images/`，通过 `liftmarkImages` 语义 key 引用。

## 设计依据

- 当前 UI 规范：`docs/ui/liftmark-ui-design-spec.md`。
- 品牌规范：`docs/brand/brand-guideline.md`。
- 旧 `docs/ui/lifton-ui-design-spec.md` 仅保留为历史迁移入口，不再作为实现依据。

## 不变约束

- 页面不散落 hex 颜色、字号和圆角。
- UI 组件不包含业务逻辑。
- 不破坏 SQLite、Repository、seed 数据和训练记录。
- Web 不是第一阶段验收目标，Android APK 预览是当前主验收方式。
