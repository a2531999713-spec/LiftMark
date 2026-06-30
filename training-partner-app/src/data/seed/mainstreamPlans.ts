import type {
  ExercisePriority,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  ReferenceLift,
  Weekday,
} from '@/domain/plan/plan.types';

export const MAINSTREAM_PLAN_IDS = {
  beginnerFullBody: 'plan_beginner_full_body',
  classicBodyPartSplit: 'plan_classic_body_part_four_day_split',
  upperLower: 'plan_upper_lower_split',
  basicStrength5x5: 'plan_basic_strength_5x5',
  fatLossMaintenance: 'plan_fat_loss_maintenance',
  recovery: 'plan_recovery_training',
  homeDumbbell: 'plan_home_dumbbell',
} as const;

export const DEFAULT_MAINSTREAM_USER_PLAN_ID = 'plan_user_beginner_full_body_default';
export const DEFAULT_MAINSTREAM_ORIGIN_SCHEME_ID = 'scheme_beginner_full_body';

type ExerciseDefinition = {
  exerciseId: string;
  notes?: string;
  priority?: ExercisePriority;
  referenceLift?: ReferenceLift;
  repMax?: number;
  repMin?: number;
  reps?: number;
  restSeconds?: number;
  sets: number;
};

type DayDefinition = {
  focus: string;
  key: string;
  title: string;
  weekday: Weekday;
  exercises: ExerciseDefinition[];
};

type MainstreamPlanDefinition = {
  description: string;
  durationWeeks: number;
  frequencyPerWeek: number;
  goal: PlanTemplate['goal'];
  key: keyof typeof MAINSTREAM_PLAN_IDS;
  name: string;
  phaseName: string;
  phaseType: PlanPhase['type'];
  days: DayDefinition[];
};

const standardProgression =
  '达到目标次数上限后小幅加重；状态不好时先完成动作质量，不追求力竭。';

const planDefinitions: MainstreamPlanDefinition[] = [
  {
    key: 'beginnerFullBody',
    name: '新手全身训练计划',
    goal: 'general',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    phaseName: '新手动作基础周期',
    phaseType: 'strength',
    description: '全身 A/B/C 三天轮换，适合刚开始训练或希望建立稳定习惯的用户。',
    days: [
      {
        key: 'a',
        title: '全身 A',
        focus: '深蹲 / 卧推 / 划船',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 3, reps: 5, referenceLift: 'squat', restSeconds: 150 },
          { exerciseId: 'ex_001', priority: 'A', sets: 3, reps: 5, referenceLift: 'bench', restSeconds: 150 },
          { exerciseId: 'ex_018', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_072', priority: 'C', sets: 3, repMin: 20, repMax: 40, restSeconds: 60 },
        ],
      },
      {
        key: 'b',
        title: '全身 B',
        focus: '硬拉 / 推举 / 下拉',
        weekday: 3,
        exercises: [
          { exerciseId: 'ex_022', priority: 'A', sets: 2, reps: 5, referenceLift: 'deadlift', restSeconds: 180 },
          { exerciseId: 'ex_016', priority: 'A', sets: 3, reps: 5, referenceLift: 'overhead_press', restSeconds: 120 },
          { exerciseId: 'ex_017', priority: 'B', sets: 3, repMin: 6, repMax: 10, referenceLift: 'pullup_total', restSeconds: 90 },
          { exerciseId: 'ex_026', priority: 'C', sets: 2, repMin: 8, repMax: 12, restSeconds: 75 },
        ],
      },
      {
        key: 'c',
        title: '全身 C',
        focus: '深蹲技术 / 上斜推 / 后链',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 3, reps: 5, referenceLift: 'squat', restSeconds: 150 },
          { exerciseId: 'ex_005', priority: 'A', sets: 3, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 90 },
          { exerciseId: 'ex_011', priority: 'B', sets: 3, repMin: 8, repMax: 10, referenceLift: 'deadlift', restSeconds: 120 },
          { exerciseId: 'ex_076', priority: 'C', sets: 3, repMin: 20, repMax: 40, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: 'classicBodyPartSplit',
    name: '经典四分化增肌计划',
    goal: 'hypertrophy',
    durationWeeks: 8,
    frequencyPerWeek: 4,
    phaseName: '胸背肩腿增肌周期',
    phaseType: 'hypertrophy',
    description: '每周 4 天，按胸三头、背二头、肩、腿拆分训练容量，适合稳定增肌。',
    days: [
      {
        key: 'chest_triceps',
        title: '胸 + 三头',
        focus: '卧推 / 上斜推 / 夹胸 / 臂屈伸',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_001', priority: 'A', sets: 4, repMin: 5, repMax: 8, referenceLift: 'bench', restSeconds: 150 },
          { exerciseId: 'ex_005', priority: 'A', sets: 3, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 105 },
          { exerciseId: 'ex_019', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_030', priority: 'B', sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_007', priority: 'C', sets: 3, repMin: 10, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_046', priority: 'C', sets: 2, repMin: 12, repMax: 15, restSeconds: 60 },
        ],
      },
      {
        key: 'back_biceps',
        title: '背 + 二头',
        focus: '引体 / 划船 / 下压 / 弯举',
        weekday: 2,
        exercises: [
          { exerciseId: 'ex_017', priority: 'A', sets: 4, repMin: 6, repMax: 10, referenceLift: 'pullup_total', restSeconds: 120 },
          { exerciseId: 'ex_018', priority: 'A', sets: 4, repMin: 6, repMax: 10, restSeconds: 120 },
          { exerciseId: 'ex_090', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_036', priority: 'B', sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_105', priority: 'C', sets: 3, repMin: 8, repMax: 12, restSeconds: 75 },
          { exerciseId: 'ex_039', priority: 'C', sets: 2, repMin: 10, repMax: 15, restSeconds: 60 },
        ],
      },
      {
        key: 'shoulders',
        title: '肩',
        focus: '推举 / 侧平举 / 后束 / 面拉',
        weekday: 4,
        exercises: [
          { exerciseId: 'ex_016', priority: 'A', sets: 4, repMin: 5, repMax: 8, referenceLift: 'overhead_press', restSeconds: 120 },
          { exerciseId: 'ex_020', priority: 'B', sets: 4, repMin: 12, repMax: 20, restSeconds: 60 },
          { exerciseId: 'ex_037', priority: 'B', sets: 3, repMin: 12, repMax: 20, restSeconds: 60 },
          { exerciseId: 'ex_094', priority: 'B', sets: 3, repMin: 8, repMax: 12, referenceLift: 'overhead_press', restSeconds: 90 },
          { exerciseId: 'ex_006', priority: 'C', sets: 3, repMin: 12, repMax: 20, restSeconds: 60 },
          { exerciseId: 'ex_045', priority: 'C', sets: 2, repMin: 10, repMax: 15, restSeconds: 60 },
        ],
      },
      {
        key: 'legs',
        title: '腿',
        focus: '深蹲 / 硬拉 / 腿举 / 腿屈伸',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 4, repMin: 5, repMax: 8, referenceLift: 'squat', restSeconds: 180 },
          { exerciseId: 'ex_011', priority: 'A', sets: 3, repMin: 6, repMax: 10, referenceLift: 'deadlift', restSeconds: 150 },
          { exerciseId: 'ex_010', priority: 'B', sets: 3, repMin: 10, repMax: 15, restSeconds: 120 },
          { exerciseId: 'ex_048', priority: 'B', sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_012', priority: 'C', sets: 3, repMin: 10, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_013', priority: 'C', sets: 4, repMin: 12, repMax: 20, restSeconds: 45 },
        ],
      },
    ],
  },
  {
    key: 'upperLower',
    name: '上肢 / 下肢分化计划',
    goal: 'hypertrophy',
    durationWeeks: 8,
    frequencyPerWeek: 4,
    phaseName: '上下肢增肌周期',
    phaseType: 'hypertrophy',
    description: '每周 4 天，按上肢和下肢分配容量，适合有基础并能稳定训练的人。',
    days: [
      {
        key: 'upper_a',
        title: '上肢 A',
        focus: '卧推 / 划船 / 肩推',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_001', priority: 'A', sets: 4, repMin: 5, repMax: 8, referenceLift: 'bench', restSeconds: 150 },
          { exerciseId: 'ex_018', priority: 'A', sets: 4, repMin: 6, repMax: 10, restSeconds: 120 },
          { exerciseId: 'ex_016', priority: 'B', sets: 3, repMin: 6, repMax: 10, referenceLift: 'overhead_press', restSeconds: 120 },
          { exerciseId: 'ex_020', priority: 'C', sets: 3, repMin: 12, repMax: 20, restSeconds: 60 },
        ],
      },
      {
        key: 'lower_a',
        title: '下肢 A',
        focus: '深蹲 / 腿举 / 腘绳肌',
        weekday: 2,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 4, repMin: 5, repMax: 8, referenceLift: 'squat', restSeconds: 180 },
          { exerciseId: 'ex_010', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 120 },
          { exerciseId: 'ex_011', priority: 'B', sets: 3, repMin: 8, repMax: 10, referenceLift: 'deadlift', restSeconds: 120 },
          { exerciseId: 'ex_050', priority: 'C', sets: 3, repMin: 10, repMax: 20, restSeconds: 60 },
        ],
      },
      {
        key: 'upper_b',
        title: '上肢 B',
        focus: '上斜推 / 下拉 / 手臂',
        weekday: 4,
        exercises: [
          { exerciseId: 'ex_005', priority: 'A', sets: 4, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 120 },
          { exerciseId: 'ex_017', priority: 'A', sets: 4, repMin: 6, repMax: 10, referenceLift: 'pullup_total', restSeconds: 120 },
          { exerciseId: 'ex_006', priority: 'B', sets: 3, repMin: 12, repMax: 20, restSeconds: 60 },
          { exerciseId: 'ex_038', priority: 'C', sets: 3, repMin: 10, repMax: 15, restSeconds: 60 },
        ],
      },
      {
        key: 'lower_b',
        title: '下肢 B',
        focus: '硬拉 / 单腿 / 核心',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_022', priority: 'A', sets: 3, repMin: 4, repMax: 6, referenceLift: 'deadlift', restSeconds: 180 },
          { exerciseId: 'ex_026', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_012', priority: 'B', sets: 3, repMin: 10, repMax: 15, restSeconds: 75 },
          { exerciseId: 'ex_072', priority: 'C', sets: 3, repMin: 20, repMax: 45, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: 'basicStrength5x5',
    name: '5x5 基础力量计划',
    goal: 'strength',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    phaseName: '5x5 基础力量周期',
    phaseType: 'strength',
    description: '围绕深蹲、卧推、硬拉、推举和划船的小步加重计划。',
    days: [
      {
        key: 'a',
        title: '5x5 A',
        focus: '深蹲 / 卧推 / 划船',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 5, reps: 5, referenceLift: 'squat', restSeconds: 180 },
          { exerciseId: 'ex_001', priority: 'A', sets: 5, reps: 5, referenceLift: 'bench', restSeconds: 180 },
          { exerciseId: 'ex_018', priority: 'A', sets: 5, reps: 5, restSeconds: 150 },
          { exerciseId: 'ex_072', priority: 'C', sets: 3, repMin: 20, repMax: 45, restSeconds: 60 },
        ],
      },
      {
        key: 'b',
        title: '5x5 B',
        focus: '深蹲 / 推举 / 硬拉',
        weekday: 3,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 5, reps: 5, referenceLift: 'squat', restSeconds: 180 },
          { exerciseId: 'ex_016', priority: 'A', sets: 5, reps: 5, referenceLift: 'overhead_press', restSeconds: 150 },
          { exerciseId: 'ex_022', priority: 'A', sets: 1, reps: 5, referenceLift: 'deadlift', restSeconds: 180 },
          { exerciseId: 'ex_017', priority: 'B', sets: 3, repMin: 6, repMax: 10, referenceLift: 'pullup_total', restSeconds: 90 },
        ],
      },
      {
        key: 'c',
        title: '5x5 C',
        focus: '深蹲 / 卧推变式 / 后链',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 5, reps: 5, referenceLift: 'squat', restSeconds: 180 },
          { exerciseId: 'ex_002', priority: 'A', sets: 4, reps: 5, referenceLift: 'bench', restSeconds: 150 },
          { exerciseId: 'ex_011', priority: 'B', sets: 3, repMin: 6, repMax: 8, referenceLift: 'deadlift', restSeconds: 120 },
          { exerciseId: 'ex_076', priority: 'C', sets: 3, repMin: 20, repMax: 40, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: 'fatLossMaintenance',
    name: '减脂保肌训练计划',
    goal: 'fat_loss',
    durationWeeks: 6,
    frequencyPerWeek: 3,
    phaseName: '减脂保肌周期',
    phaseType: 'conditioning',
    description: '保留复合动作和适中容量，适合减脂期维持肌肉和力量表现。',
    days: [
      {
        key: 'strength',
        title: '力量保留',
        focus: '主项保留 / 辅助少量',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_008', priority: 'A', sets: 3, reps: 5, referenceLift: 'squat', restSeconds: 150 },
          { exerciseId: 'ex_001', priority: 'A', sets: 3, reps: 5, referenceLift: 'bench', restSeconds: 150 },
          { exerciseId: 'ex_018', priority: 'B', sets: 3, repMin: 8, repMax: 10, restSeconds: 90 },
        ],
      },
      {
        key: 'volume',
        title: '全身容量',
        focus: '推拉腿均衡',
        weekday: 3,
        exercises: [
          { exerciseId: 'ex_005', priority: 'A', sets: 3, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 90 },
          { exerciseId: 'ex_017', priority: 'A', sets: 3, repMin: 8, repMax: 12, referenceLift: 'pullup_total', restSeconds: 90 },
          { exerciseId: 'ex_010', priority: 'B', sets: 3, repMin: 10, repMax: 15, restSeconds: 90 },
          { exerciseId: 'ex_116', priority: 'C', sets: 1, repMin: 20, repMax: 30, restSeconds: 60 },
        ],
      },
      {
        key: 'hinge',
        title: '后链与体能',
        focus: '硬拉 / 农夫行走 / 核心',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_022', priority: 'A', sets: 2, repMin: 3, repMax: 5, referenceLift: 'deadlift', restSeconds: 180 },
          { exerciseId: 'ex_026', priority: 'B', sets: 3, repMin: 8, repMax: 12, restSeconds: 75 },
          { exerciseId: 'ex_076', priority: 'B', sets: 4, repMin: 20, repMax: 40, restSeconds: 60 },
          { exerciseId: 'ex_072', priority: 'C', sets: 3, repMin: 20, repMax: 45, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: 'recovery',
    name: '恢复训练计划',
    goal: 'general',
    durationWeeks: 4,
    frequencyPerWeek: 2,
    phaseName: '恢复适应周期',
    phaseType: 'deload',
    description: '低压力全身训练，适合疲劳较高、刚恢复训练或短期降负荷。',
    days: [
      {
        key: 'easy_a',
        title: '恢复 A',
        focus: '轻推拉 / 动作质量',
        weekday: 2,
        exercises: [
          { exerciseId: 'ex_081', priority: 'A', sets: 3, repMin: 8, repMax: 10, referenceLift: 'bench', restSeconds: 90 },
          { exerciseId: 'ex_055', priority: 'A', sets: 3, repMin: 10, repMax: 12, restSeconds: 75 },
          { exerciseId: 'ex_118', priority: 'B', sets: 1, repMin: 8, repMax: 10, restSeconds: 45 },
          { exerciseId: 'ex_073', priority: 'C', sets: 2, repMin: 8, repMax: 12, restSeconds: 45 },
        ],
      },
      {
        key: 'easy_b',
        title: '恢复 B',
        focus: '轻下肢 / 核心稳定',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_083', priority: 'A', sets: 3, repMin: 8, repMax: 10, referenceLift: 'squat', restSeconds: 90 },
          { exerciseId: 'ex_087', priority: 'A', sets: 3, repMin: 8, repMax: 10, referenceLift: 'deadlift', restSeconds: 90 },
          { exerciseId: 'ex_112', priority: 'B', sets: 3, repMin: 10, repMax: 15, restSeconds: 60 },
          { exerciseId: 'ex_074', priority: 'C', sets: 2, repMin: 20, repMax: 40, restSeconds: 45 },
        ],
      },
    ],
  },
  {
    key: 'homeDumbbell',
    name: '居家哑铃训练计划',
    goal: 'general',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    phaseName: '居家哑铃基础周期',
    phaseType: 'hypertrophy',
    description: '围绕哑铃推、拉、蹲、髋铰链和核心的居家训练方案。',
    days: [
      {
        key: 'push_pull',
        title: '哑铃上肢',
        focus: '卧推 / 划船 / 肩推',
        weekday: 1,
        exercises: [
          { exerciseId: 'ex_077', priority: 'A', sets: 4, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 90 },
          { exerciseId: 'ex_090', priority: 'A', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_093', priority: 'B', sets: 3, repMin: 8, repMax: 12, referenceLift: 'overhead_press', restSeconds: 75 },
          { exerciseId: 'ex_038', priority: 'C', sets: 3, repMin: 10, repMax: 15, restSeconds: 60 },
        ],
      },
      {
        key: 'legs',
        title: '哑铃下肢',
        focus: '分腿蹲 / 哑铃硬拉 / 核心',
        weekday: 3,
        exercises: [
          { exerciseId: 'ex_026', priority: 'A', sets: 4, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_087', priority: 'A', sets: 4, repMin: 8, repMax: 12, referenceLift: 'deadlift', restSeconds: 90 },
          { exerciseId: 'ex_110', priority: 'B', sets: 3, repMin: 10, repMax: 12, restSeconds: 75 },
          { exerciseId: 'ex_072', priority: 'C', sets: 3, repMin: 20, repMax: 45, restSeconds: 60 },
        ],
      },
      {
        key: 'full',
        title: '哑铃全身',
        focus: '全身循环 / 搬运',
        weekday: 5,
        exercises: [
          { exerciseId: 'ex_005', priority: 'A', sets: 3, repMin: 8, repMax: 12, referenceLift: 'bench', restSeconds: 90 },
          { exerciseId: 'ex_033', priority: 'A', sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
          { exerciseId: 'ex_076', priority: 'B', sets: 4, repMin: 20, repMax: 40, restSeconds: 60 },
          { exerciseId: 'ex_075', priority: 'C', sets: 3, repMin: 12, repMax: 20, restSeconds: 60 },
        ],
      },
    ],
  },
];

export function createMainstreamPlanTemplateSeeds(now: string): PlanTemplate[] {
  return planDefinitions.map((definition) => ({
    id: MAINSTREAM_PLAN_IDS[definition.key],
    name: definition.name,
    visibility: 'system',
    goal: definition.goal,
    durationWeeks: definition.durationWeeks,
    frequencyPerWeek: definition.frequencyPerWeek,
    description: definition.description,
    source: 'system',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));
}

export const mainstreamPlanPhaseSeeds: PlanPhase[] = planDefinitions.map((definition) => ({
  id: `phase_${definition.key}_base`,
  planId: MAINSTREAM_PLAN_IDS[definition.key],
  name: definition.phaseName,
  type: definition.phaseType,
  startWeek: 1,
  endWeek: definition.durationWeeks,
  orderIndex: 1,
}));

export const mainstreamPlanDaySeeds: PlanDay[] = planDefinitions.flatMap((definition) => {
  const planId = MAINSTREAM_PLAN_IDS[definition.key];
  const phaseId = `phase_${definition.key}_base`;
  return Array.from({ length: definition.durationWeeks }, (_, weekIndex) => {
    const week = weekIndex + 1;
    return definition.days.map((day, dayIndex) => ({
      id: `day_${definition.key}_w${week}_d${dayIndex + 1}`,
      planId,
      phaseId,
      week,
      weekday: day.weekday,
      title: day.title,
      focus: day.focus,
      notes: standardProgression,
    }));
  }).flat();
});

export const mainstreamPlanExerciseSeeds: PlanExercise[] = planDefinitions.flatMap((definition) =>
  mainstreamPlanDaySeeds
    .filter((day) => day.planId === MAINSTREAM_PLAN_IDS[definition.key])
    .flatMap((day) => {
      const dayIndex = Number(day.id.split('_d').at(-1)) - 1;
      const dayDefinition = definition.days[dayIndex] ?? definition.days[0];
      return dayDefinition.exercises.map((exercise, exerciseIndex) => ({
        id: `pe_${day.id}_${exerciseIndex + 1}`,
        planDayId: day.id,
        exerciseId: exercise.exerciseId,
        priority: exercise.priority ?? 'A',
        orderIndex: exerciseIndex + 1,
        sets: exercise.sets,
        reps: exercise.reps,
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        intensityType: 'manual',
        referenceLift: exercise.referenceLift ?? 'none',
        restSeconds: exercise.restSeconds ?? 90,
        notes: exercise.notes ?? standardProgression,
      }));
    }),
);
