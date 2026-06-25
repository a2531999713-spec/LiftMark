# UI 模块概览

更新时间：2026-06-14

## 2026-06-24 我的页 UI 更新

- 我的页顶部改为账号与训练身份主卡，重点展示用户、登录状态、当前成员、所在小组和训练角色。
- 普通用户可见的我的页不再展示试用模式、SQLite/seed 诊断、清空测试数据、重置默认计划或云同步/会员主视觉广告。
- 新增 `src/components/profile/` 组件：`ProfileHeader`、`ProfileHeroCard`、`ProfileSection`、`ProfileMenuItem` 和 `LogoutButton`。
- 云同步、会员、激活码、账号安全、数据删除和开发诊断均进入二级入口或隐藏开发者模式。

UI 模块负责“练刻 LiftMark”的移动端视觉系统、基础组件、品牌资源和核心页面布局规范。

## 当前范围

- 底部导航：首页、计划、记录、我的。
- 基础 UI 组件：`Screen`、`AppText`、`AppCard`、`AppButton`、`SectionHeader`、`Tag`、`MetricCard`、`ActionCard`、`EmptyState`、`SettingsRow`、`DangerZone`、`VisualHeroCard`。
- Theme token：`src/theme/colors.ts`、`spacing.ts`、`typography.ts`、`radius.ts`、`shadows.ts`。
- 品牌资源：`assets/brand/` 和 `src/assets/brand/`。
- 训练氛围图：`src/assets/images/`，通过 `liftmarkImages` 语义 key 引用。
- 首页：`app/(tabs)/today.tsx`，定位为今日训练任务中心，承载今天练什么、今日重点、当前搭子、本周简要概览和开始训练入口。

## 设计依据

- 当前 UI 规范：`docs/ui/liftmark-ui-design-spec.md`。
- 品牌规范：`docs/brand/brand-guideline.md`。
- 旧 `docs/ui/lifton-ui-design-spec.md` 仅保留为历史迁移入口，不再作为实现依据。

## 不变约束

- 页面不散落 hex 颜色、字号和圆角。
- UI 组件不包含业务逻辑。
- 不破坏 SQLite、Repository、seed 数据和训练记录。
- Web 不是第一阶段验收目标，Android APK 预览是当前主验收方式。
