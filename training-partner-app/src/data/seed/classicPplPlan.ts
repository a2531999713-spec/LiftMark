import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';

export const CLASSIC_PPL_PLAN_ID = 'plan_classic_three_day_ppl';
export const CLASSIC_PPL_SCHEME_ID = 'scheme_classic_three_day_ppl';

export function createClassicPplPlanTemplateSeed(now: string): PlanTemplate {
  return {
    id: CLASSIC_PPL_PLAN_ID,
    name: '经典三分化 PPL',
    visibility: 'system',
    goal: 'hypertrophy',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    description: '推 / 拉 / 腿三天循环，适合每周训练 3 天，兼顾增肌和基础力量。',
    source: 'system',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export const classicPplPhaseSeed: PlanPhase = {
  id: 'phase_classic_ppl_base',
  planId: CLASSIC_PPL_PLAN_ID,
  name: 'PPL 双进阶周期',
  type: 'hypertrophy',
  startWeek: 1,
  endWeek: 8,
  orderIndex: 1,
};

const dayDefinitions = [
  {
    key: 'push',
    title: '推 Push',
    focus: '胸肩三头',
    weekday: 1 as const,
    notes: '卧推、上斜推、肩推、侧平举和三头训练。',
  },
  {
    key: 'pull',
    title: '拉 Pull',
    focus: '后链背部二头',
    weekday: 2 as const,
    notes: '硬拉或髋铰链、垂直拉、划船、后束和二头训练。',
  },
  {
    key: 'legs',
    title: '腿 Legs',
    focus: '深蹲腿部后链',
    weekday: 3 as const,
    notes: '深蹲、腿举、髋铰链、单腿训练和提踵。',
  },
];

export const classicPplPlanDaySeeds: PlanDay[] = Array.from({ length: 8 }, (_, weekIndex) => {
  const week = weekIndex + 1;
  return dayDefinitions.map((day, index) => ({
    id: `day_classic_ppl_w${week}_d${index + 1}`,
    planId: CLASSIC_PPL_PLAN_ID,
    phaseId: classicPplPhaseSeed.id,
    week,
    weekday: day.weekday,
    title: `Day ${index + 1}：${day.title}`,
    focus: day.focus,
    notes: day.notes,
  }));
}).flat();

const progressionNote =
  '双进阶：所有工作组达到目标次数上限后下次加重；未达下限维持；连续两次低于下限时下次降重 5%-10%。';

const exerciseDefinitions: Record<string, Omit<PlanExercise, 'id' | 'planDayId'>[]> = {
  push: [
    {
      exerciseId: 'ex_001',
      priority: 'A',
      orderIndex: 1,
      sets: 4,
      repMin: 5,
      repMax: 8,
      intensityType: 'manual',
      referenceLift: 'bench',
      restSeconds: 150,
      notes: `杠铃卧推。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_005',
      priority: 'A',
      orderIndex: 2,
      sets: 3,
      repMin: 8,
      repMax: 12,
      intensityType: 'manual',
      referenceLift: 'bench',
      restSeconds: 120,
      notes: `上斜哑铃卧推。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_016',
      priority: 'B',
      orderIndex: 3,
      sets: 3,
      repMin: 6,
      repMax: 10,
      intensityType: 'manual',
      referenceLift: 'overhead_press',
      restSeconds: 120,
      notes: `坐姿或站姿推举。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_020',
      priority: 'B',
      orderIndex: 4,
      sets: 3,
      repMin: 12,
      repMax: 20,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 75,
      notes: `侧平举。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_007',
      priority: 'C',
      orderIndex: 5,
      sets: 3,
      repMin: 10,
      repMax: 15,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 75,
      notes: `绳索下压或臂屈伸。保留余力。${progressionNote}`,
    },
  ],
  pull: [
    {
      exerciseId: 'ex_022',
      priority: 'A',
      orderIndex: 1,
      sets: 3,
      repMin: 4,
      repMax: 6,
      intensityType: 'manual',
      referenceLift: 'deadlift',
      restSeconds: 180,
      notes: `硬拉或罗马尼亚硬拉。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_017',
      priority: 'A',
      orderIndex: 2,
      sets: 4,
      repMin: 6,
      repMax: 10,
      intensityType: 'manual',
      referenceLift: 'pullup_total',
      restSeconds: 120,
      notes: `引体向上或高位下拉。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_018',
      priority: 'B',
      orderIndex: 3,
      sets: 3,
      repMin: 8,
      repMax: 12,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 120,
      notes: `杠铃划船或器械划船。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_006',
      priority: 'B',
      orderIndex: 4,
      sets: 3,
      repMin: 12,
      repMax: 20,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 75,
      notes: `面拉或反向飞鸟。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_038',
      priority: 'C',
      orderIndex: 5,
      sets: 3,
      repMin: 10,
      repMax: 15,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 75,
      notes: `哑铃弯举。保留余力。${progressionNote}`,
    },
  ],
  legs: [
    {
      exerciseId: 'ex_008',
      priority: 'A',
      orderIndex: 1,
      sets: 4,
      repMin: 5,
      repMax: 8,
      intensityType: 'manual',
      referenceLift: 'squat',
      restSeconds: 180,
      notes: `深蹲。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_010',
      priority: 'A',
      orderIndex: 2,
      sets: 3,
      repMin: 8,
      repMax: 12,
      intensityType: 'manual',
      referenceLift: 'squat',
      restSeconds: 150,
      notes: `腿举或前蹲。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_011',
      priority: 'B',
      orderIndex: 3,
      sets: 3,
      repMin: 8,
      repMax: 12,
      intensityType: 'manual',
      referenceLift: 'deadlift',
      restSeconds: 120,
      notes: `罗马尼亚硬拉或腿弯举。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_026',
      priority: 'B',
      orderIndex: 4,
      sets: 3,
      repMin: 8,
      repMax: 12,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 120,
      notes: `保加利亚分腿蹲。保留余力。${progressionNote}`,
    },
    {
      exerciseId: 'ex_013',
      priority: 'C',
      orderIndex: 5,
      sets: 4,
      repMin: 10,
      repMax: 20,
      intensityType: 'manual',
      referenceLift: 'none',
      restSeconds: 75,
      notes: `提踵。保留余力。${progressionNote}`,
    },
  ],
};

export const classicPplPlanExerciseSeeds: PlanExercise[] = classicPplPlanDaySeeds.flatMap((day) => {
  const key = day.id.includes('_d1') ? 'push' : day.id.includes('_d2') ? 'pull' : 'legs';
  return exerciseDefinitions[key].map((exercise) => ({
    ...exercise,
    id: `pe_${day.id}_${exercise.orderIndex}`,
    planDayId: day.id,
  }));
});
