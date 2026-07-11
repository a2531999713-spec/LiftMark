// 练刻 LiftMark 管理员控制台 —— 演示数据模块（mock data）

export function maskPhone(p: string) {
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export const dashboardStats = {
  newUsers: 128,
  activeUsers: 1043,
  logins: 2871,
  trainings: 486,
  newGroups: 17,
  newRecords: 612,
  proUsers: 934,
  lifetimeUsers: 121,
  codeRedeems: 58,
  orderAmount: 12860,
  paidOrders: 74,
  refundOrders: 3,
  syncFailed: 12,
  uploadFailed: 5,
  pendingFeedback: 9,
  abnormalUsers: 4,
}

export const trendData = {
  users: [62, 80, 71, 95, 88, 110, 128],
  active: [780, 812, 905, 870, 1002, 990, 1043],
  trainings: [320, 410, 388, 452, 430, 470, 486],
  orders: [8600, 9200, 10400, 9800, 11200, 12100, 12860],
  redeems: [30, 42, 38, 51, 47, 55, 58],
  syncFail: [22, 18, 25, 15, 19, 14, 12],
}

export const trendLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export type Todo = {
  id: string
  type: string
  variant: 'danger' | 'warning' | 'info'
  title: string
  time: string
  count: number
}

export const pendingTasks: Todo[] = [
  { id: 't1', type: '同步失败', variant: 'danger', title: '12 个同步任务连续失败', time: '5 分钟前', count: 12 },
  { id: 't2', type: '支付异常', variant: 'danger', title: '2 笔订单已支付未发放权益', time: '18 分钟前', count: 2 },
  { id: 't3', type: '用户反馈', variant: 'warning', title: '9 条待处理反馈工单', time: '32 分钟前', count: 9 },
  { id: 't4', type: '头像上传失败', variant: 'warning', title: '5 个头像上传处理失败', time: '1 小时前', count: 5 },
  { id: 't5', type: '训练数据异常', variant: 'warning', title: '3 条训练记录数据异常', time: '2 小时前', count: 3 },
  { id: 't6', type: '在线房间异常', variant: 'info', title: '1 个在线同练房间卡死', time: '3 小时前', count: 1 },
  { id: 't7', type: '备份失败', variant: 'danger', title: '昨夜增量备份校验未通过', time: '9 小时前', count: 1 },
  { id: 't8', type: '服务器告警', variant: 'warning', title: 'API 节点 P95 延迟升高', time: '10 小时前', count: 1 },
]

export type MemberStatus = 'active' | 'disabled' | 'abnormal'
export type MembershipTier = 'free' | 'pro' | 'lifetime'
export type SyncStatus =
  | 'synced'
  | 'pending_sync'
  | 'syncing'
  | 'sync_failed'
  | 'conflict'
  | 'local_only'
  | 'deleted_pending'

export const syncStatusLabel: Record<SyncStatus, string> = {
  synced: '已同步',
  pending_sync: '待同步',
  syncing: '同步中',
  sync_failed: '同步失败',
  conflict: '数据冲突',
  local_only: '仅本地',
  deleted_pending: '待删除同步',
}

export type User = {
  id: string
  name: string
  avatar: string
  phone: string
  liftId: string
  gender: string
  age: number
  registeredAt: string
  lastLogin: string
  tier: MembershipTier
  tierExpire?: string
  groups: number
  members: number
  trainings: number
  sync: SyncStatus
  status: MemberStatus
  hasFeedback: boolean
  hasPayment: boolean
}

const names = ['张伟', '李强', '王芳', '刘洋', '陈静', '杨帆', '赵磊', '周敏', '吴昊', '郑爽', '孙宇', '马涛']

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]
}

export const users: User[] = Array.from({ length: 42 }).map((_, i) => {
  const tier: MembershipTier = i % 7 === 0 ? 'lifetime' : i % 3 === 0 ? 'pro' : 'free'
  const status: MemberStatus =
    i === 4 ? 'abnormal' : i === 9 ? 'disabled' : 'active'
  const sync: SyncStatus = pick<SyncStatus>(
    ['synced', 'synced', 'synced', 'pending_sync', 'sync_failed', 'conflict', 'local_only'],
    i,
  )
  return {
    id: `U${(100234 + i).toString()}`,
    name: `${pick(names, i)}`,
    avatar: '',
    phone: `138${(10000000 + i * 111119).toString().slice(0, 8)}`,
    liftId: `LM${(388211 + i * 37).toString()}`,
    gender: i % 2 === 0 ? '男' : '女',
    age: 20 + (i % 25),
    registeredAt: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    lastLogin: `2026-07-0${(i % 5) + 1} 1${i % 9}:2${i % 6}`,
    tier,
    tierExpire: tier === 'pro' ? '2026-12-31' : tier === 'lifetime' ? '永久' : undefined,
    groups: (i % 4) + (tier === 'free' ? 0 : 1),
    members: (i % 6) + 1,
    trainings: (i * 13) % 240,
    sync,
    status,
    hasFeedback: i % 5 === 0,
    hasPayment: tier !== 'free',
  }
})

export function getUser(id: string) {
  return users.find((u) => u.id === id)
}

export type Membership = {
  id: string
  userId: string
  userName: string
  tier: MembershipTier
  status: 'active' | 'expired' | 'revoked'
  source: 'manual' | 'payment' | 'code' | 'beta' | 'campus' | 'partner' | 'compensation'
  startAt: string
  endAt: string
  proGroups: number
  usedProGroups: number
  maxPerGroup: number
  operator: string
  note: string
}

const sourceLabels = ['manual', 'payment', 'code', 'beta', 'campus', 'partner', 'compensation'] as const

export const memberships: Membership[] = users
  .filter((u) => u.tier !== 'free')
  .map((u, i) => ({
    id: `MB${(50011 + i).toString()}`,
    userId: u.id,
    userName: u.name,
    tier: u.tier,
    status: i === 3 ? 'expired' : i === 6 ? 'revoked' : 'active',
    source: pick([...sourceLabels], i),
    startAt: '2025-08-01',
    endAt: u.tier === 'lifetime' ? '永久' : '2026-12-31',
    proGroups: u.tier === 'lifetime' ? 10 : 3,
    usedProGroups: i % 3,
    maxPerGroup: u.tier === 'lifetime' ? 12 : 6,
    operator: i % 2 === 0 ? 'system' : 'Wang Admin',
    note: i % 4 === 0 ? '客服补偿' : '',
  }))

export type ActivationCode = {
  id: string
  code: string
  type: string
  campaign: string
  benefit: string
  validUntil: string
  total: number
  used: number
  perUser: number
  status: 'active' | 'disabled' | 'expired'
  creator: string
  createdAt: string
  channel: string
}

export const codeTypes = [
  '通用活动码',
  '一次性兑换码',
  '批量兑换码',
  '内测码',
  '校园推广码',
  '合作方码',
  '客服补偿码',
  '永久会员码',
]

export const activationCodes: ActivationCode[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `AC${(9001 + i).toString()}`,
  code: `LM-${pick(['GEN', 'ONE', 'BAT', 'BETA', 'CAMP', 'PART', 'COMP', 'LIFE'], i)}-${(1000 + i * 137).toString(36).toUpperCase()}`,
  type: pick(codeTypes, i),
  campaign: pick(['夏日健身季', '内测招募', '高校推广', '合作方联名', '客服补偿', '双十一活动'], i),
  benefit: pick(['Pro 30 天', 'Pro 90 天', 'Pro 180 天', 'Pro 365 天', '永久会员', 'Pro 30 天 + 1 组名额'], i),
  validUntil: `2026-${String((i % 12) + 1).padStart(2, '0')}-28`,
  total: pick([1, 50, 100, 500, 1000], i),
  used: (i * 17) % 60,
  perUser: 1,
  status: i === 5 ? 'disabled' : i === 8 ? 'expired' : 'active',
  creator: i % 2 === 0 ? 'Wang Admin' : 'Li Ops',
  createdAt: `2025-${String((i % 12) + 1).padStart(2, '0')}-10`,
  channel: pick(['官网', 'App 内', '微信', '线下', '合作方', '客服'], i),
}))

export type Group = {
  id: string
  name: string
  owner: string
  ownerPhone: string
  members: number
  plan: string
  type: '普通小组' | 'Pro 小组'
  pro: boolean
  weekTrainings: number
  totalTrainings: number
  lastTraining: string
  sync: SyncStatus
  createdAt: string
  abnormal: boolean
}

export const groups: Group[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `G${(3001 + i).toString()}`,
  name: pick(['清晨力量小队', '宿舍撸铁团', '深蹲研究所', '硬拉兄弟会', '周末训练营', '实验室健身组'], i) + ` #${i + 1}`,
  owner: pick(names, i),
  ownerPhone: `138${(10000000 + i * 222227).toString().slice(0, 8)}`,
  members: (i % 6) + 2,
  plan: pick(['5x5 强力', '531 主课', 'PPL 推拉腿', 'GZCLP', '自定义-春季周期'], i),
  type: i % 3 === 0 ? 'Pro 小组' : '普通小组',
  pro: i % 3 === 0,
  weekTrainings: i % 5,
  totalTrainings: (i * 9) % 180,
  lastTraining: `2026-07-0${(i % 5) + 1}`,
  sync: pick<SyncStatus>(['synced', 'synced', 'pending_sync', 'conflict', 'sync_failed'], i),
  createdAt: `2025-${String((i % 12) + 1).padStart(2, '0')}-15`,
  abnormal: i === 7,
}))

export function getGroup(id: string) {
  return groups.find((g) => g.id === id)
}

export type MemberProfile = {
  id: string
  name: string
  ownerUser: string
  group: string
  boundAccount: boolean
  localOnly: boolean
  weight: number
  rmComplete: boolean
  trainings: number
  lastTraining: string
  sync: SyncStatus
}

export const memberProfiles: MemberProfile[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `M${(7001 + i).toString()}`,
  name: pick(names, i + 3),
  ownerUser: pick(names, i),
  group: pick(['清晨力量小队', '宿舍撸铁团', '深蹲研究所'], i),
  boundAccount: i % 3 !== 0,
  localOnly: i % 5 === 0,
  weight: 55 + (i % 40),
  rmComplete: i % 4 !== 0,
  trainings: (i * 7) % 150,
  lastTraining: `2026-07-0${(i % 5) + 1}`,
  sync: pick<SyncStatus>(['synced', 'pending_sync', 'sync_failed', 'local_only'], i),
}))

export function getMember(id: string) {
  return memberProfiles.find((m) => m.id === id)
}

export type TrainingSession = {
  id: string
  user: string
  group: string
  title: string
  date: string
  status: 'completed' | 'in_progress' | 'aborted' | 'planned'
  source: '本地' | '云同步' | '在线同练' | '补录'
  memberCount: number
  exercises: number
  sets: number
  volume: number
  duration: number
  sync: SyncStatus
  abnormal: boolean
  updatedAt: string
}

export const sessions: TrainingSession[] = Array.from({ length: 28 }).map((_, i) => ({
  id: `S${(20001 + i).toString()}`,
  user: pick(names, i),
  group: pick(['清晨力量小队', '宿舍撸铁团', '深蹲研究所'], i),
  title: pick(['Day A - 下肢', 'Day B - 上肢', '推日', '拉日', '腿日', '全身'], i),
  date: `2026-07-0${(i % 5) + 1}`,
  status: pick(['completed', 'completed', 'in_progress', 'aborted', 'planned'] as const, i),
  source: pick(['本地', '云同步', '在线同练', '补录'] as const, i),
  memberCount: (i % 4) + 1,
  exercises: (i % 6) + 3,
  sets: (i % 12) + 12,
  volume: 3200 + i * 137,
  duration: 45 + (i % 40),
  sync: pick<SyncStatus>(['synced', 'pending_sync', 'sync_failed', 'conflict'], i),
  abnormal: i === 4 || i === 11,
  updatedAt: `2026-07-0${(i % 5) + 1} 20:${10 + (i % 40)}`,
}))

export function getSession(id: string) {
  return sessions.find((s) => s.id === id)
}

export type SyncTask = {
  id: string
  user: string
  device: string
  dataType: string
  objectId: string
  reason: string
  retries: number
  lastFail: string
  lastSuccess: string
  status: SyncStatus
}

export const syncTasks: SyncTask[] = Array.from({ length: 16 }).map((_, i) => ({
  id: `SY${(60001 + i).toString()}`,
  user: pick(names, i),
  device: pick(['iPhone 15 Pro', 'Xiaomi 14', 'Pixel 8', 'iPad Air'], i),
  dataType: pick(['训练 session', '成员档案', '小组数据', '计划', '头像文件'], i),
  objectId: `S${20001 + i}`,
  reason: pick(
    ['网络超时', '版本冲突（409）', '服务端 500', '数据校验失败', '主键重复', '负载均衡断连'],
    i,
  ),
  retries: (i % 6) + 1,
  lastFail: `2026-07-05 1${i % 9}:2${i % 6}`,
  lastSuccess: i % 3 === 0 ? '—' : `2026-07-04 09:1${i % 9}`,
  status: pick<SyncStatus>(['sync_failed', 'conflict', 'sync_failed', 'pending_sync'], i),
}))

export type Device = {
  id: string
  user: string
  platform: string
  appVersion: string
  osVersion: string
  model: string
  lastLogin: string
  lastSync: string
  ip: string
  status: 'active' | 'abnormal' | 'unbound'
}

export const devices: Device[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `D${(80001 + i).toString()}`,
  user: pick(names, i),
  platform: i % 2 === 0 ? 'iOS' : 'Android',
  appVersion: pick(['1.8.2', '1.8.1', '1.7.9', '1.8.0'], i),
  osVersion: i % 2 === 0 ? `iOS 18.${i % 5}` : `Android 1${i % 5}`,
  model: pick(['iPhone 15 Pro', 'Xiaomi 14', 'Pixel 8', 'iPad Air', 'OPPO Find X7'], i),
  lastLogin: `2026-07-0${(i % 5) + 1} 08:${10 + (i % 40)}`,
  lastSync: `2026-07-0${(i % 5) + 1} 20:${10 + (i % 40)}`,
  ip: `112.65.${i}.${100 + i}`,
  status: i === 6 ? 'abnormal' : i === 13 ? 'unbound' : 'active',
}))

export type Room = {
  id: string
  group: string
  creator: string
  status: 'active' | 'ended' | 'abnormal'
  participants: number
  currentExercise: string
  progress: string
  lastSeq: number
  startAt: string
  endAt: string
}

export const rooms: Room[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `R${(90001 + i).toString()}`,
  group: pick(['清晨力量小队', '宿舍撸铁团', '深蹲研究所'], i),
  creator: pick(names, i),
  status: i === 2 ? 'abnormal' : i % 3 === 0 ? 'active' : 'ended',
  participants: (i % 5) + 2,
  currentExercise: pick(['杠铃深蹲', '卧推', '硬拉', '引体向上', '过头推举'], i),
  progress: `${(i % 5) + 1}/${(i % 3) + 5} 组`,
  lastSeq: 100 + i * 13,
  startAt: `2026-07-0${(i % 5) + 1} 18:00`,
  endAt: i % 3 === 0 ? '进行中' : `2026-07-0${(i % 5) + 1} 19:30`,
}))

export type Order = {
  id: string
  user: string
  product: string
  amount: number
  channel: string
  payStatus: 'paid' | 'unpaid' | 'failed' | 'refunded'
  benefitStatus: 'granted' | 'pending' | 'failed'
  refundStatus: 'none' | 'refunding' | 'refunded'
  createdAt: string
  paidAt: string
}

export const orders: Order[] = Array.from({ length: 22 }).map((_, i) => ({
  id: `O${(202607000 + i).toString()}`,
  user: pick(names, i),
  product: pick(['Pro 年卡', 'Pro 季卡', 'Pro 月卡', '永久会员', 'Pro 小组名额 x1'], i),
  amount: pick([168, 68, 28, 498, 30], i),
  channel: pick(['微信支付', '支付宝', 'Apple IAP'], i),
  payStatus: pick(['paid', 'paid', 'paid', 'failed', 'refunded', 'unpaid'] as const, i),
  benefitStatus: i === 3 ? 'failed' : i === 7 ? 'pending' : 'granted',
  refundStatus: i === 4 ? 'refunded' : i === 10 ? 'refunding' : 'none',
  createdAt: `2026-07-0${(i % 5) + 1} 1${i % 9}:${10 + (i % 40)}`,
  paidAt: `2026-07-0${(i % 5) + 1} 1${i % 9}:${11 + (i % 40)}`,
}))

export type Feedback = {
  id: string
  user: string
  type: string
  title: string
  summary: string
  status: 'open' | 'processing' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  version: string
  hasAttachment: boolean
  createdAt: string
  handler: string
}

export const feedbackTypes = [
  '问题反馈',
  '功能建议',
  '账号问题',
  '登录问题',
  '头像问题',
  '云同步问题',
  '训练数据问题',
  '支付问题',
  '会员问题',
  '小组问题',
  '其他',
]

export const feedbacks: Feedback[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `F${(40001 + i).toString()}`,
  user: pick(names, i),
  type: pick(feedbackTypes, i),
  title: pick(
    ['云同步一直转圈', '会员到期未提醒', '头像上传失败', '训练重量计算不对', '小组邀请码失效', '希望支持 RIR'],
    i,
  ),
  summary: '用户描述：训练现场遇到问题，附带日志与截图，希望尽快处理…',
  status: pick(['open', 'processing', 'resolved', 'closed'] as const, i),
  priority: pick(['low', 'medium', 'high', 'urgent'] as const, i),
  version: pick(['1.8.2', '1.8.1', '1.7.9'], i),
  hasAttachment: i % 2 === 0,
  createdAt: `2026-07-0${(i % 5) + 1} 1${i % 9}:${10 + (i % 40)}`,
  handler: i % 3 === 0 ? '未分配' : pick(['Wang Admin', 'Li Ops', 'Zhao CS'], i),
}))

export function getFeedback(id: string) {
  return feedbacks.find((f) => f.id === id)
}

export type Announcement = {
  id: string
  title: string
  type: string
  status: 'draft' | 'published' | 'offline'
  position: string
  startAt: string
  endAt: string
  creator: string
}

export const announcements: Announcement[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `AN${(5001 + i).toString()}`,
  title: pick(
    ['v1.8.2 更新说明', '7 月会员活动开启', '7 月 6 日凌晨维护公告', '云同步故障已修复', '新增 RIR 记录功能'],
    i,
  ),
  type: pick(['功能更新', '会员活动', '维护公告', '故障说明', '普通公告', '激活码活动'], i),
  status: pick(['published', 'draft', 'offline'] as const, i),
  position: pick(['首页横幅', '启动弹窗', '我的页面', '训练页顶部'], i),
  startAt: `2026-07-0${(i % 5) + 1}`,
  endAt: `2026-07-${10 + i}`,
  creator: i % 2 === 0 ? 'Wang Admin' : 'Li Ops',
}))

export type VersionConfig = {
  platform: string
  latest: string
  minSupported: string
  forceUpdate: boolean
  title: string
  content: string
  url: string
  status: 'active' | 'draft'
}

export const versionConfigs: VersionConfig[] = [
  {
    platform: 'iOS',
    latest: '1.8.2',
    minSupported: '1.6.0',
    forceUpdate: false,
    title: '体验优化与问题修复',
    content: '修复云同步偶发失败；新增 RIR 记录；优化在线同练稳定性。',
    url: 'https://apps.apple.com/app/liftmark',
    status: 'active',
  },
  {
    platform: 'Android',
    latest: '1.8.2',
    minSupported: '1.5.0',
    forceUpdate: true,
    title: '重要更新（强制）',
    content: '修复严重的同步数据丢失问题，请务必更新。',
    url: 'https://liftmark.app/download/android',
    status: 'active',
  },
]

export const featureFlags = [
  { key: 'cloud_sync', label: '云同步', on: true },
  { key: 'online_train', label: '在线同练', on: true },
  { key: 'code_redeem', label: '激活码兑换', on: true },
  { key: 'membership_buy', label: '会员购买', on: true },
  { key: 'feedback', label: '问题反馈', on: true },
  { key: 'plan_share', label: '计划分享', on: false },
  { key: 'new_user_flow', label: '新用户推荐流程', on: true },
  { key: 'maintenance', label: '维护模式', on: false },
]

export type FileItem = {
  id: string
  type: string
  owner: string
  member: string
  size: string
  url: string
  uploadedAt: string
  status: 'ok' | 'failed' | 'orphan'
  referenced: boolean
}

export const files: FileItem[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `IMG${(11001 + i).toString()}`,
  type: pick(['用户头像', '成员头像', '反馈截图', '计划封面'], i),
  owner: pick(names, i),
  member: pick(names, i + 2),
  size: `${(120 + i * 33) % 900 + 50} KB`,
  url: `https://cdn.liftmark.app/u/${11001 + i}.webp`,
  uploadedAt: `2026-07-0${(i % 5) + 1}`,
  status: i === 3 ? 'failed' : i === 9 ? 'orphan' : 'ok',
  referenced: i !== 9,
}))

export type Plan = {
  id: string
  name: string
  type: string
  source: '系统计划' | '用户创建' | '导入' | '复制'
  owner: string
  users: number
  phases: number
  days: number
  exercises: number
  enabled: boolean
  abnormal: boolean
  updatedAt: string
}

export const plans: Plan[] = Array.from({ length: 16 }).map((_, i) => ({
  id: `PL${(6001 + i).toString()}`,
  name: pick(['5x5 强力', '531 主课', 'PPL 推拉腿', 'GZCLP', 'nSuns 531', '自定义春季周期'], i),
  type: pick(['力量', '增肌', '入门', '进阶'], i),
  source: pick(['系统计划', '用户创建', '导入', '复制'] as const, i),
  owner: i % 3 === 0 ? '系统' : pick(names, i),
  users: (i * 31) % 400,
  phases: (i % 3) + 1,
  days: (i % 4) + 3,
  exercises: (i % 8) + 8,
  enabled: i !== 5,
  abnormal: i === 8,
  updatedAt: `2026-06-${10 + i}`,
}))

export type Exercise = {
  id: string
  name: string
  pattern: string
  equipment: string
  muscle: string
  system: boolean
  creator: string
  uses: number
  alternatives: number
  status: 'active' | 'disabled' | 'abnormal'
}

export const exercises: Exercise[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `EX${(2001 + i).toString()}`,
  name: pick(
    ['杠铃深蹲', '卧推', '硬拉', '过头推举', '引体向上', '划船', '罗马尼亚硬拉', '腿举', '二头弯举', '三头下压'],
    i,
  ),
  pattern: pick(['下肢推', '上肢推', '髋铰链', '上肢拉', '核心'], i),
  equipment: pick(['杠铃', '哑铃', '器械', '自重', '龙门架'], i),
  muscle: pick(['股四头', '胸大肌', '背阔肌', '三角肌', '肱二头'], i),
  system: i % 4 !== 0,
  creator: i % 4 === 0 ? pick(names, i) : '系统',
  uses: (i * 53) % 900,
  alternatives: (i % 5) + 1,
  status: i === 12 ? 'abnormal' : i === 15 ? 'disabled' : 'active',
}))

export type LogEntry = {
  id: string
  operator: string
  module: string
  target: string
  action: string
  before: string
  after: string
  reason: string
  time: string
  ip: string
  device: string
  risk: 'low' | 'medium' | 'high'
  rollbackable: boolean
}

export const logs: LogEntry[] = Array.from({ length: 26 }).map((_, i) => ({
  id: `L${(700001 + i).toString()}`,
  operator: pick(['Wang Admin', 'Li Ops', 'Zhao CS', 'Sun Tech'], i),
  module: pick(['用户管理', '会员与权益', '激活码', '训练数据', '云同步', '订单支付', '小组管理'], i),
  target: pick(['U100234', 'MB50011', 'AC9001', 'S20001', 'G3001'], i),
  action: pick(
    ['发放会员 Pro 90 天', '修改手机号', '删除异常训练组', '撤销会员', '重置同步状态', '补发订单权益', '转移小组 owner'],
    i,
  ),
  before: pick(['tier=free', '138****1234', 'sets=13', 'active', 'sync_failed', 'pending', 'owner=张伟'], i),
  after: pick(['tier=pro', '139****5678', 'sets=12', 'revoked', 'synced', 'granted', 'owner=李强'], i),
  reason: pick(['客服补偿', '用户申诉核实', '数据异常修正', '违规处理', '同步排障', '支付异常补发', '组长转让'], i),
  time: `2026-07-0${(i % 5) + 1} 1${i % 9}:${10 + (i % 40)}`,
  ip: `10.0.${i}.${100 + i}`,
  device: 'Chrome / macOS',
  risk: pick(['low', 'medium', 'high'] as const, i),
  rollbackable: i % 2 === 0,
}))

export type Backup = {
  id: string
  type: string
  time: string
  size: string
  status: 'success' | 'failed' | 'running'
  location: string
  verified: 'ok' | 'failed' | 'pending'
}

export const backups: Backup[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `BK${(30001 + i).toString()}`,
  type: i % 4 === 0 ? '全量备份' : '增量备份',
  time: `2026-07-0${(i % 5) + 1} 03:00`,
  size: `${(2 + i * 0.7).toFixed(1)} GB`,
  status: i === 1 ? 'failed' : i === 0 ? 'running' : 'success',
  location: pick(['对象存储 OSS', 'PC 灾备盘', '异地备份'], i),
  verified: i === 1 ? 'failed' : i === 0 ? 'pending' : 'ok',
}))

export type Admin = {
  id: string
  name: string
  role: string
  email: string
  lastActive: string
  status: 'active' | 'disabled'
}

export const adminRoles = [
  { key: 'super', name: '超级管理员', desc: '所有权限', color: 'danger' as const },
  { key: 'ops', name: '运营管理员', desc: '用户、会员、激活码、反馈、公告', color: 'primary' as const },
  { key: 'cs', name: '客服管理员', desc: '用户查看、反馈处理、补偿申请', color: 'info' as const },
  { key: 'finance', name: '财务管理员', desc: '订单、支付、退款', color: 'warning' as const },
  { key: 'tech', name: '技术管理员', desc: '同步、日志、备份、系统监控', color: 'success' as const },
  { key: 'audit', name: '只读审计员', desc: '只读查看', color: 'outline' as const },
]

export const permissionDims = [
  '查看', '新增', '编辑', '删除', '导出', '发放权益', '撤销权益',
  '修改用户数据', '修改训练数据', '查看敏感信息', '系统配置', '备份恢复', '管理员管理',
]

export const admins: Admin[] = [
  { id: 'A1', name: 'Wang Admin', role: '超级管理员', email: 'wang@liftmark.app', lastActive: '2026-07-05 14:20', status: 'active' },
  { id: 'A2', name: 'Li Ops', role: '运营管理员', email: 'li@liftmark.app', lastActive: '2026-07-05 13:02', status: 'active' },
  { id: 'A3', name: 'Zhao CS', role: '客服管理员', email: 'zhao@liftmark.app', lastActive: '2026-07-05 11:41', status: 'active' },
  { id: 'A4', name: 'Chen Finance', role: '财务管理员', email: 'chen@liftmark.app', lastActive: '2026-07-04 18:33', status: 'active' },
  { id: 'A5', name: 'Sun Tech', role: '技术管理员', email: 'sun@liftmark.app', lastActive: '2026-07-05 09:15', status: 'active' },
  { id: 'A6', name: 'Auditor', role: '只读审计员', email: 'audit@liftmark.app', lastActive: '2026-07-03 16:00', status: 'disabled' },
]

export type Correction = {
  id: string
  targetType: string
  target: string
  user: string
  field: string
  before: string
  after: string
  reason: string
  operator: string
  time: string
  syncToDevice: boolean
  recompute: boolean
  status: 'done' | 'pending' | 'rolledback'
  ticket: string
}

export const corrections: Correction[] = Array.from({ length: 14 }).map((_, i) => ({
  id: `FIX${(80001 + i).toString()}`,
  targetType: pick(['用户资料', '会员权益', '训练 session', '每组数据', '同步状态', '成员档案', '订单权益'], i),
  target: pick(['U100234', 'MB50011', 'S20001', 'M7001', 'O202607000'], i),
  user: pick(names, i),
  field: pick(['手机号', 'tier', 'session.sets[3].weight', 'weight', 'syncStatus', 'nickname'], i),
  before: pick(['138****1234', 'free', '80kg', '72', 'sync_failed', '张伟'], i),
  after: pick(['139****5678', 'pro', '85kg', '75', 'synced', '张三'], i),
  reason: pick(['用户申诉核实', '客服补偿', '数据异常修正', '同步排障'], i),
  operator: pick(['Wang Admin', 'Li Ops', 'Sun Tech'], i),
  time: `2026-07-0${(i % 5) + 1} 1${i % 9}:${10 + (i % 40)}`,
  syncToDevice: i % 2 === 0,
  recompute: i % 3 === 0,
  status: pick(['done', 'pending', 'rolledback'] as const, i),
  ticket: i % 2 === 0 ? `F${40001 + i}` : '—',
}))

export const monitorServices = [
  { name: 'API 服务', status: 'ok', detail: 'P95 128ms · QPS 340' },
  { name: 'PostgreSQL', status: 'ok', detail: '连接 42/200 · 主从正常' },
  { name: 'Redis / 队列', status: 'warning', detail: '同步队列积压 128' },
  { name: '对象存储', status: 'ok', detail: '可用 · 延迟 40ms' },
]

export const monitorMetrics = [
  { name: 'CPU 使用率', value: 46, unit: '%' },
  { name: '内存使用率', value: 63, unit: '%' },
  { name: '磁盘使用率', value: 71, unit: '%' },
  { name: '错误率', value: 0.8, unit: '%' },
]

export const monitorErrors = [
  { time: '14:22', level: 'error', msg: 'SyncService: conflict resolve failed objectId=S20014' },
  { time: '13:58', level: 'warn', msg: 'Upload: image compress timeout img=IMG11004' },
  { time: '13:31', level: 'error', msg: 'Payment: callback signature mismatch order=O202607003' },
  { time: '12:47', level: 'warn', msg: 'Room: heartbeat missing room=R90003' },
]
