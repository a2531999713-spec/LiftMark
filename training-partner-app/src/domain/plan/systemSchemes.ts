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
  audience: string;
  dayStructure: string;
  description: string;
  equipmentRequirement: string;
  experienceRequirement: string;
  isRecommended: boolean;
  recommendationReason: string;
  tags: string[];
  schemeVersion: number;
  isAvailable: boolean;
  isComingSoon: boolean;
  templatePlanId?: ID;
};

export const SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID = 'scheme_beginner_full_body';
export const SYSTEM_SCHEME_CLASSIC_PPL_ID = 'scheme_classic_three_day_ppl';
export const SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID = 'scheme_classic_body_part_four_day_split';
export const SYSTEM_SCHEME_UPPER_LOWER_ID = 'scheme_upper_lower_split';
export const SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID = 'scheme_basic_strength_5x5';
export const SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID = 'scheme_fat_loss_maintenance';
export const SYSTEM_SCHEME_RECOVERY_ID = 'scheme_recovery_training';
export const SYSTEM_SCHEME_HOME_DUMBBELL_ID = 'scheme_home_dumbbell';

export const systemTrainingSchemes: SystemTrainingScheme[] = [
  {
    id: SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID,
    title: '新手全身训练计划',
    subtitle: '全身 A/B/C 三天轮换，先建立动作质量和稳定训练节奏。',
    goal: 'general',
    level: 'beginner',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    audience: '刚开始训练、训练中断后重新开始、每周能训练 2-3 天的人',
    dayStructure: '全身 A / 全身 B / 全身 C',
    description: '用深蹲、卧推、硬拉、推举、划船和核心动作建立基础能力。',
    equipmentRequirement: '健身房完整器械，或至少有杠铃、哑铃和下拉/划船替代',
    experienceRequirement: '0-3 个月训练经验',
    isRecommended: true,
    recommendationReason: '动作数量克制，频率低，适合作为新用户默认训练计划。',
    tags: ['新手', '全身', '3 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_beginner_full_body',
  },
  {
    id: SYSTEM_SCHEME_CLASSIC_PPL_ID,
    title: 'Push Pull Legs 三分化计划',
    subtitle: '推 / 拉 / 腿三天循环，适合每周训练 3 天，兼顾增肌和基础力量。',
    goal: 'hypertrophy',
    level: 'intermediate',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    audience: '有基础动作经验、想用三分化增肌的人',
    dayStructure: 'Day 1 推 Push / Day 2 拉 Pull / Day 3 腿 Legs',
    description:
      '推、拉、腿三天循环，使用双进阶：所有工作组达到目标次数上限后下次加重；连续低于目标下限时降重 5%-10%。',
    equipmentRequirement: '健身房完整器械',
    experienceRequirement: '3-12 个月或以上训练经验',
    isRecommended: true,
    recommendationReason: '三天频率清晰，动作覆盖全面，适合大多数增肌用户。',
    tags: ['PPL', '三分化', '增肌', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_classic_three_day_ppl',
  },
  {
    id: SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
    title: '经典四分化增肌计划',
    subtitle: '胸 + 三头、背 + 二头、肩、腿，每周 4 天的主流增肌拆分。',
    goal: 'hypertrophy',
    level: 'intermediate',
    frequencyPerWeek: 4,
    durationWeeks: 8,
    audience: '每周能稳定训练 4 天、想用身体部位分化增加容量的人',
    dayStructure: 'Day 1 胸 + 三头 / Day 2 背 + 二头 / Day 3 肩 / Day 4 腿',
    description: '按身体部位拆分训练容量，主项动作在前，孤立动作收尾，适合常规健身房增肌训练。',
    equipmentRequirement: '健身房完整器械',
    experienceRequirement: '3-12 个月或以上训练经验',
    isRecommended: true,
    recommendationReason: '四天身体部位分化清晰，符合主流增肌训练路径。',
    tags: ['四分化', '增肌', '4 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_classic_body_part_four_day_split',
  },
  {
    id: SYSTEM_SCHEME_UPPER_LOWER_ID,
    title: '上肢 / 下肢分化计划',
    subtitle: '每周 4 天，上下肢轮换，适合稳定增加训练容量。',
    goal: 'hypertrophy',
    level: 'intermediate',
    frequencyPerWeek: 4,
    durationWeeks: 8,
    audience: '每周能训练 4 天、希望兼顾增肌和动作练习的人',
    dayStructure: '上肢 A / 下肢 A / 上肢 B / 下肢 B',
    description: '以复合动作为主，按上下肢拆分容量，避免单日内容过长。',
    equipmentRequirement: '健身房完整器械',
    experienceRequirement: '3-12 个月训练经验',
    isRecommended: true,
    recommendationReason: '每周 4 天结构直观，比复杂高频拆分更容易长期执行。',
    tags: ['增肌', '上下肢', '4 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_upper_lower_split',
  },
  {
    id: SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID,
    title: '5x5 基础力量计划',
    subtitle: '围绕深蹲、卧推、硬拉、推举和划船的小步加重。',
    goal: 'strength',
    level: 'intermediate',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    audience: '有基础动作经验、想优先提升主项力量的人',
    dayStructure: '5x5 A / 5x5 B / 5x5 C',
    description: '三天全身力量训练，小步加重，主项优先，辅助动作保持克制。',
    equipmentRequirement: '杠铃、深蹲架、卧推凳和基础拉力器械',
    experienceRequirement: '3 个月以上训练经验',
    isRecommended: true,
    recommendationReason: '每周三练，动作稳定，适合力量目标和可恢复训练节奏。',
    tags: ['增力', '5x5', '3 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_basic_strength_5x5',
  },
  {
    id: SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID,
    title: '减脂保肌训练计划',
    subtitle: '保留复合动作和适中容量，适合减脂期维持肌肉和力量。',
    goal: 'fat_loss',
    level: 'all',
    frequencyPerWeek: 3,
    durationWeeks: 6,
    audience: '减脂期、希望保留力量和训练习惯的人',
    dayStructure: '力量保留 / 全身容量 / 后链与体能',
    description: '减少不必要高容量，保留主项表现和全身肌肉刺激。',
    equipmentRequirement: '健身房完整器械',
    experienceRequirement: '有基础动作经验更适合',
    isRecommended: true,
    recommendationReason: '减脂期不追求复杂分化，三天全身结构更容易恢复。',
    tags: ['减脂', '保肌', '3 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_fat_loss_maintenance',
  },
  {
    id: SYSTEM_SCHEME_RECOVERY_ID,
    title: '恢复训练计划',
    subtitle: '低压力全身训练，适合疲劳较高或刚恢复训练。',
    goal: 'general',
    level: 'all',
    frequencyPerWeek: 2,
    durationWeeks: 4,
    audience: '疲劳较高、训练中断后恢复、或短期需要降负荷的人',
    dayStructure: '恢复 A / 恢复 B',
    description: '以动作质量、轻负荷和稳定恢复为先，减少高压力主项。',
    equipmentRequirement: '健身房基础器械或可替代轻器械',
    experienceRequirement: '任何训练经验',
    isRecommended: true,
    recommendationReason: '当用户选择恢复训练或疲劳较高时，低频低压力更合适。',
    tags: ['恢复', '低压力', '2 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_recovery_training',
  },
  {
    id: SYSTEM_SCHEME_HOME_DUMBBELL_ID,
    title: '居家哑铃训练方案',
    subtitle: '器械有限时的全身力量与肌肉训练。',
    goal: 'general',
    level: 'beginner',
    frequencyPerWeek: 3,
    durationWeeks: 8,
    audience: '只有哑铃、无法稳定去健身房、或居家训练的人',
    dayStructure: '哑铃上肢 / 哑铃下肢 / 哑铃全身',
    description: '围绕哑铃推、拉、蹲、髋铰链和核心动作建立居家训练闭环。',
    equipmentRequirement: '哑铃和基础训练空间',
    experienceRequirement: '0-12 个月训练经验',
    isRecommended: true,
    recommendationReason: '当器械条件有限时，优先给出可执行的哑铃方案。',
    tags: ['居家', '哑铃', '3 天', '完整可用'],
    schemeVersion: 1,
    isAvailable: true,
    isComingSoon: false,
    templatePlanId: 'plan_home_dumbbell',
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
