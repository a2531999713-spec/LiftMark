# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Behavior Rules

- DO NOT send optional commentary or progress updates. Just do the work silently.

# UI Design Rules — LiftMark Mobile Design System

**核心原则：** 这是一个 React Native 移动健身应用，不是网页。所有设计决策必须从移动端体验出发。

## 禁止的反模式（NEVER）

- ❌ 标签+输入框垂直堆叠的表单列表
- ❌ 左边 label 右边 value 的设置行（iOS Settings 风格）
- ❌ 全宽边框输入框 + 上方标签
- ❌ 所有元素单列等间距排列
- ❌ 纯白背景无视觉层次
- ❌ 纯文字按钮无视觉权重
- ❌ 网页式导航栏（移动端用底部 Tab）
- ❌ 没有 SafeAreaView 的页面
- ❌ 没有键盘避让处理的输入页面

## 必须使用的移动端模式（ALWAYS）

- ✅ **卡片布局** — `AppCard` 组件，圆角 `radius.lg`，阴影 `shadows.card`
- ✅ **SafeAreaView** — 所有页面必须处理刘海屏和底部安全区
- ✅ **键盘避让** — 输入页面使用 `ScrollView` + `keyboardShouldPersistTaps="handled"`
- ✅ **触摸反馈** — `Pressable` 的 `pressed` 状态（opacity 0.85 + scale 0.98）
- ✅ **底部 Tab 导航** — 使用 expo-router 的 `(tabs)` 布局
- ✅ **渐进式披露** — 先摘要，点击展开详情
- ✅ **空状态** — 使用 `EmptyState` 组件，带图标+标题+描述+按钮

## 主题系统（必须使用）

```typescript
import { colors, spacing, radius, shadows, typography } from '@/theme';
```

### 颜色（从 colors.ts）
- `colors.brand` / `colors.primary` — `#FF4A3D` 品牌红（主操作）
- `colors.accent` — `#4C7CFF` 蓝色（次要操作）
- `colors.success` — `#19C37D` 绿色（完成状态）
- `colors.warning` — `#FFB020` 黄色（警告）
- `colors.danger` — `#E5484D` 红色（删除、错误）
- `colors.background` — `#F4F6F8` 屏幕背景
- `colors.surface` — `#FFFFFF` 卡片背景
- `colors.surfaceMuted` — `#F1F3F6` 次要背景
- `colors.text` — `#1E293B` 主文字
- `colors.textMuted` — `#64748B` 次要文字
- `colors.textSubtle` — `#94A3B8` 弱化文字
- `colors.border` — `#E5EAF0` 边框
- `colors.darkCard` — `#1A2332` 深色卡片

### 间距（从 spacing.ts）
- `spacing.xxs` — 2px
- `spacing.xs` — 4px
- `spacing.sm` — 8px
- `spacing.md` — 12px
- `spacing.lg` — 16px
- `spacing.xl` — 20px
- `spacing.xxl` — 28px
- `spacing.xxxl` — 36px
- `spacing.xxxxl` — 48px

### 圆角（从 radius.ts）
- `radius.xs` — 6px
- `radius.sm` — 8px
- `radius.md` — 12px
- `radius.lg` — 14px
- `radius.xl` — 18px
- `radius.pill` — 999px（胶囊按钮）

### 阴影（从 shadows.ts）
- `shadows.card` — 卡片阴影
- `shadows.sm` — 小阴影
- `shadows.md` — 中等阴影

## 现有组件（优先使用）

| 组件 | 用途 | 导入路径 |
|------|------|----------|
| `Screen` | 页面容器，处理 SafeArea 和 ScrollView | `@/components/ui` |
| `AppCard` | 卡片容器，支持 tone: default/soft/brand/dark | `@/components/ui` |
| `AppButton` | 按钮，支持 variant: primary/secondary/danger/ghost/dark | `@/components/ui` |
| `AppText` | 文字，支持 variant 和 tone | `@/components/ui` |
| `MetricCard` | 数据指标卡片（label + value + delta） | `@/components/ui` |
| `ActionCard` | 可点击操作卡片（icon + label + description） | `@/components/ui` |
| `Tag` | 标签，支持 tone: success/warning/danger/brand/soft | `@/components/ui` |
| `EmptyState` | 空状态（icon + title + description + action） | `@/components/ui` |
| `SectionHeader` | 区块标题 | `@/components/ui` |
| `SettingsRow` | 设置行（label + value）| `@/components/ui` |
| `Avatar` | 头像组件 | `@/components/ui` |
| `SecondaryPageHeader` | 二级页面头部 | `@/components/ui` |

## 组件模式

### Screen 页面结构
```tsx
import { Screen } from '@/components/ui';

// 基础页面
<Screen title="页面标题" subtitle="副标题">
  {/* 内容 */}
</Screen>

// 不滚动的页面（如训练中）
<Screen safeTop={false} scroll={false}>
  {/* 内容 */}
</Screen>
```

### AppCard 卡片
```tsx
import { AppCard } from '@/components/ui';

// 默认卡片
<AppCard>
  <AppText>内容</AppText>
</AppCard>

// 品牌色背景
<AppCard tone="brand">
  <AppText>重要内容</AppText>
</AppCard>

// 深色卡片
<AppCard tone="dark">
  <AppText style={{ color: colors.surface }}>深色背景文字</AppText>
</AppCard>
```

### AppButton 按钮
```tsx
import { AppButton } from '@/components/ui';

// 主要按钮
<AppButton icon="add-circle-outline" onPress={handlePress}>
  开始训练
</AppButton>

// 次要按钮
<AppButton variant="secondary" onPress={handlePress}>
  取消
</AppButton>

// 危险按钮
<AppButton variant="danger" onPress={handleDelete}>
  删除
</AppButton>

// 幽灵按钮（无边框）
<AppButton variant="ghost" onPress={handleCancel}>
  取消
</AppButton>
```

### MetricCard 数据卡片
```tsx
import { MetricCard } from '@/components/ui';

<View style={{ flexDirection: 'row', gap: spacing.md }}>
  <MetricCard label="TOTAL SESSIONS" value="42" delta="+12%" />
  <MetricCard label="VOLUME" value="12.5t" delta="-5%" />
</View>
```

### ActionCard 操作卡片
```tsx
import { ActionCard } from '@/components/ui';

<View style={{ flexDirection: 'row', gap: spacing.sm }}>
  <ActionCard
    icon="barbell-outline"
    label="开始训练"
    description="开始新的训练"
    onPress={handleStart}
  />
  <ActionCard
    icon="people-outline"
    label="邀请成员"
    description="分享邀请码"
    onPress={handleInvite}
  />
</View>
```

### EmptyState 空状态
```tsx
import { EmptyState } from '@/components/ui';

<EmptyState
  icon="barbell-outline"
  title="暂无训练"
  description="开始你的第一次训练吧"
  actionLabel="开始训练"
  onActionPress={handleStart}
/>
```

## 移动端特定规范

### SafeAreaView 处理
- 所有页面必须使用 `Screen` 组件（内置 SafeArea）
- 训练中页面可以禁用顶部安全区：`safeTop={false}`
- 底部安全区由 Tab Bar 自动处理

### 键盘处理
- 输入页面使用 `ScrollView` + `keyboardShouldPersistTaps="handled"`
- 数字输入使用 `keyboardType="numeric"`
- 搜索输入使用 `returnKeyType="search"`

### 触摸反馈
- 所有可点击元素使用 `Pressable`
- 添加 `pressed` 状态：`opacity: 0.85, transform: [{ scale: 0.98 }]`
- 按钮最小高度：sm=38, md=48, lg=52

### 横向滚动
- 成员头像、操作快捷方式使用横向 `ScrollView`
- 设置 `showsHorizontalScrollIndicator={false}`
- 使用 `contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}`

### 列表
- 使用 `@shopify/flash-list` 替代 FlatList
- 设置 `estimatedItemSize` 优化性能

## 屏幕特定规范

### 训练页（workout/[sessionId].tsx）
- 计时器是 Hero 元素，使用大号数字
- 当前组记录卡片居中突出
- 成员轮换用 `GroupMemberStrip` 横向滚动
- 已完成组用 `CompletedSetList` 紧凑列表
- 进度条用 `WorkoutProgressStrip`

### 今日训练页（(tabs)/today.tsx）
- 使用 `ImageBackground` 作为 Hero 区域
- 周统计用 `WorkoutLiveStatsBar`
- 计划详情用卡片分组
- 成员头像横向滚动

### 设置页（(tabs)/settings.tsx）
- 使用 `ProfileHeroCard` 展示用户信息
- 使用 `ProfileMenuItem` 作为菜单项
- 不要用 iOS 风格的 grouped table

### 同步诊断页（profile/sync.tsx）
- 状态用 `Tag` 组件，不用文字段落
- 图标+标签+值 横向排列在 `SettingsRow`
- 相关检查分组到 `AppCard`
- 操作按钮底部全宽

## 预检查清单

发布任何页面前：
- [ ] 使用了 `Screen` 组件（SafeArea 已处理）
- [ ] 使用了 `AppCard` 分组内容，不是裸 View
- [ ] 使用了 `@/theme` 中的颜色、间距、圆角
- [ ] 可点击元素有 `pressed` 触摸反馈
- [ ] 输入页面有键盘避让处理
- [ ] 空状态使用了 `EmptyState` 组件
- [ ] 没有小于 12px 的文字
- [ ] 触摸目标至少 44x44px
- [ ] 使用了 Ionicons 图标
- [ ] 加载状态使用了 `ActivityIndicator` 或骨架屏
- [ ] 没有硬编码颜色值
