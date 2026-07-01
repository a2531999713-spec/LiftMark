# UI 模块概览

更新时间：2026-06-30

## 2026-06-30 训练选择与二级页 UI 补充

- 今日训练页把用户可见的动作取舍入口改为“动作筛选”，明确它会影响本次创建 session 的动作快照。
- 计划页系统方案收进“计划库”弹层，主界面只保留当前计划、周安排、我的计划和低频操作入口。
- 历史训练详情默认只读，编辑和删除在更多菜单中进入；小组动作详情提供指标、范围和成员筛选。
- 普通二级页使用 `Screen safeTop={false}` 避免 Stack 返回区和页面内容之间出现重复顶部留白。
- 训练执行轮换顺序卡、训练首页、总结和历史小组分析统一使用真实头像。
- 折线图组件统一使用真实 Y 轴刻度、单位、绘图区 padding 和空状态；周趋势使用日期或周起始日期。
- 训练执行页 RPE 是可选高级记录，折叠后横向滑动选择；休息面板必须显示倒计时、建议休息、已休息、下一组和下一位。

## 2026-06-24 我的页 UI 更新

- 我的页顶部改为深海军蓝账号主卡，重点展示用户昵称、练刻 ID、手机号掩码、默认训练小组人数和当前计划。HeroCard 小组和计划区域可点击跳转。
- 我的页主入口固定为训练档案、小组成员、偏好设置、账号设置；关于练刻独立成组，退出登录收进账号设置。
- 普通用户可见的我的页不再展示试用模式、SQLite/seed 诊断、重建测试数据、重置默认计划或数据同步/会员主视觉广告。
- 新增 / 更新 `src/components/profile/` 组件：`ProfileHeroCard`、`ProfileSection`、`ProfileMenuItem` 和 `LogoutButton`。
- 新增 `src/components/avatar/`，账号头像与训练成员头像分离展示，点击头像直接打开相册选择并上传服务器。
- 会员、激活码、账号安全和数据删除均进入二级入口；数据同步相关入口当前不作为用户主流程展示。
- 退出登录只保留在账号设置二级页，“我的”首页不再展示退出按钮。
- 训练首页、成员页、历史小组对比和训练总结统一使用 `Avatar` 展示账号或成员头像。
- 普通二级页 Stack header 不再展示默认中文标题，仅保留系统返回按钮；全屏流程页使用页面内返回入口。

UI 模块负责“练刻 LiftMark”的移动端视觉系统、基础组件、品牌资源和核心页面布局规范。

## 当前范围

- 底部导航：首页、计划、记录、我的。
- 基础 UI 组件：`Screen`、`AppText`、`AppCard`、`AppButton`、`SectionHeader`、`Tag`、`MetricCard`、`MiniLineChart`、`MultiLineTrendChart`、`ActionCard`、`EmptyState`、`SettingsRow`、`DangerZone`、`VisualHeroCard`、`Avatar`。
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
