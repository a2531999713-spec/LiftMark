# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Behavior Rules

- DO NOT send optional commentary or progress updates. Just do the work silently.

# UI Design Rules — LiftMark Design System

**核心原则：** 每个页面都应该像一个高级健身应用，而不是数据录入表单。

## 禁止的反模式（NEVER）

- ❌ 标签+输入框垂直堆叠的表单列表
- ❌ 左边 label 右边 value 的设置行
- ❌ 全宽边框输入框 + 上方标签
- ❌ 所有元素单列等间距排列
- ❌ 纯白背景无视觉层次
- ❌ 纯文字按钮无视觉权重
- ❌ Settings 风格的 iOS grouped table view

## 必须使用的现代模式（ALWAYS）

- ✅ **卡片布局** — 圆角16、阴影、分组内容
- ✅ **视觉层次** — Hero 元素 → 区块 → 详情
- ✅ **混合布局** — 网格、横向滚动、不对称排列
- ✅ **操作导向 CTA** — 主要操作大、彩色、突出
- ✅ **渐进式披露** — 先摘要，点击看详情
- ✅ **空状态带插图** — 图标+文字+按钮，不是纯文字

## 间距系统（8px base）

- xs: 4px — 紧凑内联间距
- sm: 8px — 相关元素之间
- md: 16px — 卡片内区块之间
- lg: 24px — 主要区块之间
- xl: 32px — 屏幕边距
- xxl: 48px — 不相关区块之间

## 卡片设计规范

```tsx
// 正确：带阴影的卡片
<AppCard style={{ padding: 16, borderRadius: 16, backgroundColor: '#fff' }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight }}>
      <Icon name="flash" size={24} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <AppText variant="subtitle" weight="bold">Quick Action</AppText>
      <AppText variant="caption" color="muted">描述文字</AppText>
    </View>
  </View>
</AppCard>

// 错误：表单行
<View style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 12 }}>
  <Text style={{ fontSize: 12, color: '#999' }}>Label</Text>
  <TextInput style={{ borderWidth: 1, padding: 8 }} />
</View>
```

## 组件模式

### 操作卡片（Action Card）
用于可点击的操作：开始训练、添加成员、上传头像等
- 左侧圆形图标容器
- 中间标题+描述
- 右侧箭头指示可点击

### 数据卡片（Stat Card）
用于显示指标：体重、次数、训练次数等
- 居中布局
- 顶部小标签（TOTAL SESSIONS）
- 大号数字
- 趋势指示

### 成员卡片（Member Card）
用于小组成员展示
- 左侧头像
- 中间名字+角色标签
- 右侧操作按钮

### 空状态（Empty State）
当没有数据时：
- 大号图标（64px）
- 标题+描述
- 操作按钮

## 屏幕特定规范

### 设置/个人资料页
- 用卡片+图标+描述，不用 iOS 风格的 grouped table
- 开关独占卡片行
- 危险操作（删除、退出）底部独立样式

### 同步/诊断页
- 状态用彩色标签，不用文字段落
- 图标+标签+值 横向排列
- 相关检查分组到卡片
- 操作按钮底部全宽

### 训练页
- 计时器和当前组是 Hero 元素
- 已完成组用紧凑列表
- 成员头像横向滚动
- 快捷操作浮动按钮

## 字体层级

| 级别 | 大小 | 粗细 | 用途 |
|------|------|------|------|
| Hero | 32-40 | 900 | 页面标题、大数字 |
| Title | 24-28 | 800 | 区块标题 |
| Subtitle | 16-18 | 700 | 卡片标题 |
| Body | 14-16 | 400 | 正文 |
| Caption | 12-13 | 400 | 辅助信息 |
| Micro | 10-11 | 500 | 标签、徽章 |

## 颜色系统

```typescript
const colors = {
  primary: '#4F46E5',        // Indigo — 主要操作
  primaryLight: '#EEF2FF',   // 浅 indigo — 背景
  accent: '#F59E0B',         // Amber — 高亮、进度
  success: '#10B981',        // Green — 完成状态
  danger: '#EF4444',         // Red — 删除、错误
  background: '#F9FAFB',     // 浅灰 — 屏幕背景
  card: '#FFFFFF',           // 白色 — 卡片背景
  text: '#111827',           // 近黑 — 主文字
  textMuted: '#6B7280',      // 灰 — 次要文字
  border: '#E5E7EB',         // 浅灰 — 边框
};
```

## 预检查清单

发布任何页面前：
- [ ] 没有 label+input 的垂直列表
- [ ] 所有内容分组在卡片中，间距正确
- [ ] 视觉层次：Hero → 区块 → 详情
- [ ] 主要操作视觉上最突出
- [ ] 空状态有图标和清晰的 CTA
- [ ] 没有小于 10px 的文字
- [ ] 触摸目标至少 44x44px
- [ ] 图标风格一致（Ionicons）
- [ ] 加载状态已处理（骨架屏，不是 spinner）

## 主题引用

```typescript
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';
```

永远不要硬编码颜色、尺寸或字体。使用主题变量。

# When to Apply These Rules

- 任何 UI 重写或布局变更
- 添加新页面或组件
- 改进现有页面布局
- 修复视觉层次或间距问题
- 配色方案或字体调整

# Workflow

1. 开始 UI 变更前，先阅读此设计规范
2. 应用卡片布局，避免表单式设计
3. 检查预检查清单
4. 使用 `@/theme` 中的颜色和间距
