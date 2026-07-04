# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Behavior Rules

- DO NOT send optional commentary or progress updates. Just do the work silently.

# LiftMark Mobile Design Rules

## 1. 禁止表单式布局

永远不要用这种结构：
```tsx
// ❌ 禁止
<View>
  <Text>标签</Text>
  <TextInput />
</View>
```

用卡片分组：
```tsx
// ✅ 正确
<AppCard>
  <AppText variant="bodySmall" tone="muted">标签</AppText>
  <TextInput style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md }} />
</AppCard>
```

## 2. 禁止重复组件

- **不要手动加返回按钮** — expo-router 的 Stack 自带返回按钮
- **不要手动加页面标题** — Screen 组件的 `title` prop 已处理
- **不要重复导航栏** — Tab 页面不需要顶部导航
- **不要在已有标题的页面再加 `<AppText variant="headline">`**

## 3. 禁止多余文字

- 每个区块最多 1-2 行文字
- 不要在卡片里放段落描述
- 用图标+数字替代文字说明
- 空状态用 `EmptyState` 组件，不要自己写

## 4. 移动端必须项

- 所有页面用 `Screen` 组件（自带 SafeArea + ScrollView）
- 可点击元素用 `Pressable`，添加 pressed 状态（opacity 0.85）
- 输入页面加 `keyboardShouldPersistTaps="handled"`

## 5. 必须使用主题

```typescript
import { colors, spacing, radius, shadows } from '@/theme';
```

不要硬编码颜色、尺寸。用 `colors.brand` 而不是 `'#FF4A3D'`，用 `spacing.md` 而不是 `12`。

## 6. 设计质量检查

- [ ] 没有 label+input 的表单结构
- [ ] 没有多余的返回按钮
- [ ] 没有重复的页面标题
- [ ] 没有多余的段落描述
- [ ] 卡片内容简洁，1-2 行
- [ ] 使用了 `@/theme` 变量
- [ ] 触摸目标 ≥ 44px
