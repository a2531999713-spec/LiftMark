import type { ID } from '@/domain/common/ids';

import type { PlanTemplate } from './plan.types';

export type SystemTrainingSchemeLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';

export type SystemTrainingScheme = {
  id: ID;
  title: string;
  subtitle: string;
  goal: PlanTemplate['goal'];
  level: SystemTrainingSchemeLevel;
  frequencyPerWeek: number;
  durationWeeks: number;
  dayStructure: string;
  description: string;
  tags: string[];
  schemeVersion: number;
  isAvailable: boolean;
  isComingSoon: boolean;
  templatePlanId?: ID;
};

export const SYSTEM_SCHEME_FOUR_DAY_ID = 'scheme_four_day_strength_hypertrophy';
export const SYSTEM_SCHEME_CLASSIC_PPL_ID = 'scheme_classic_three_day_ppl';

export const systemTrainingSchemes: SystemTrainingScheme[] = [
  {
    id: 'scheme_three_day_split',
    title: '三分化训练方案',
    subtitle: '经典三分化，适合稳定建立训练习惯',
    goal: 'hypertrophy',
    level: 'intermediate',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    dayStructure: '胸肩三头 / 背二头 / 腿核心',
    description: '适合每周训练 3 天的增肌方案，后续会补齐完整动作与进阶规则。',
    tags: ['增肌', '3 天', '经典分化'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
  {
    id: 'scheme_five_day_split',
    title: '五分化训练方案',
    subtitle: '高频肌群拆分，适合训练经验更稳定的人',
    goal: 'hypertrophy',
    level: 'advanced',
    frequencyPerWeek: 5,
    durationWeeks: 12,
    dayStructure: '胸 / 背 / 肩 / 腿 / 手臂',
    description: '面向更高训练频率的增肌方案，第一版保留入口。',
    tags: ['增肌', '5 天', '高频'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
  {
    id: SYSTEM_SCHEME_CLASSIC_PPL_ID,
    title: '经典三分化 PPL',
    subtitle: '推 / 拉 / 腿三天循环，适合每周训练 3 天，兼顾增肌和基础力量。',
    goal: 'hypertrophy',
    level: 'intermediate',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    dayStructure: 'Day 1 推 Push / Day 2 拉 Pull / Day 3 腿 Legs',
    description:
      '推、拉、腿三天循环，使用双进阶：所有工作组达到目标次数上限且 RIR >= 1 或 RPE <= 8 时下次加重；连续低于下限或 RPE 过高时降重 5%-10%。',
    tags: ['PPL', '三分化', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_classic_three_day_ppl',
  },
  {
    id: 'scheme_reverse_pyramid',
    title: '倒金字塔训练方案',
    subtitle: '大重量优先，适合关注主项表现',
    goal: 'strength',
    level: 'advanced',
    frequencyPerWeek: 4,
    durationWeeks: 6,
    dayStructure: '主项重组 / 递减回退组 / 辅助动作',
    description: '以高强度首组为核心的力量导向方案，后续补完整模板。',
    tags: ['增力', '倒金字塔', '高强度'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
  {
    id: 'scheme_beginner_linear',
    title: '新手线性进阶方案',
    subtitle: '小步加重，建立动作与训练节奏',
    goal: 'strength',
    level: 'beginner',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    dayStructure: '全身 A/B 交替',
    description: '适合新手用较低复杂度完成线性进阶，后续补动作细节。',
    tags: ['新手', '线性进阶', '3 天'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
  {
    id: SYSTEM_SCHEME_FOUR_DAY_ID,
    title: '四练增力增肌方案',
    subtitle: '6 周增力 + 1 周减量 + 8 周增肌 + 1 周减量',
    goal: 'strength',
    level: 'intermediate',
    frequencyPerWeek: 4,
    durationWeeks: 16,
    dayStructure: '卧推 / 深蹲 / 上肢容量 / 硬拉，周五补弱可选',
    description: '系统内置的完整本地方案。用户点击“使用此方案”后会复制为自己的训练计划。',
    tags: ['增力', '增肌', '4 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_four_day_strength_hypertrophy',
  },
  {
    id: 'scheme_deload_maintenance',
    title: '减量维持方案',
    subtitle: '降低容量，保留动作表现',
    goal: 'fat_loss',
    level: 'all',
    frequencyPerWeek: 3,
    durationWeeks: 4,
    dayStructure: '主项低容量 / 辅助保留 / 恢复优先',
    description: '适合减脂或恢复期维持力量表现，后续补完整模板。',
    tags: ['减量', '维持', '恢复'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
  {
    id: 'scheme_home_dumbbell',
    title: '居家哑铃训练方案',
    subtitle: '器械有限时的力量与肌肉训练',
    goal: 'general',
    level: 'beginner',
    frequencyPerWeek: 4,
    durationWeeks: 8,
    dayStructure: '上肢 / 下肢 / 推拉 / 全身',
    description: '面向居家训练和哑铃场景，后续接入完整动作库。',
    tags: ['居家', '哑铃', '通用'],
    schemeVersion: 1,
    isAvailable: false,
    isComingSoon: true,
  },
];

export function listSystemTrainingSchemes(): SystemTrainingScheme[] {
  return systemTrainingSchemes;
}

export function getSystemTrainingSchemeById(id: ID): SystemTrainingScheme | undefined {
  return systemTrainingSchemes.find((scheme) => scheme.id === id);
}

export function describeSchemeGoal(goal: PlanTemplate['goal']): string {
  const labels: Record<PlanTemplate['goal'], string> = {
    strength: '增力',
    hypertrophy: '增肌',
    fat_loss: '减量',
    general: '通用',
    custom: '自定义',
  };
  return labels[goal];
}

export function describeSchemeLevel(level: SystemTrainingSchemeLevel): string {
  const labels: Record<SystemTrainingSchemeLevel, string> = {
    beginner: '新手',
    intermediate: '初中级',
    advanced: '中高级',
    all: '通用',
  };
  return labels[level];
}
