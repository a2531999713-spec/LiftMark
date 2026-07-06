export const SYSTEM_USER_ID = 'usr_liftmark_system';
export const SYSTEM_USER_LIFTMARK_ID = 'LM00000000';

export type SystemExerciseCatalogItem = {
  category: string;
  difficulty?: string;
  equipment: string;
  id: string;
  movementPattern: string;
  name: string;
  notes?: string;
  targetMuscle: string;
};

export type SystemPlanCatalogItem = {
  description: string;
  durationWeeks: number;
  frequencyPerWeek: number;
  goal: string;
  id: string;
  name: string;
  tags: string[];
  title: string;
};

export const systemExerciseCatalog: SystemExerciseCatalogItem[] = [
  { id: 'sys_ex_bench_press', name: '杠铃卧推', category: 'chest', movementPattern: 'horizontal_push', targetMuscle: '胸部', equipment: 'barbell', difficulty: 'intermediate', notes: '基础水平推主项。' },
  { id: 'sys_ex_pause_bench', name: '暂停卧推', category: 'chest', movementPattern: 'horizontal_push', targetMuscle: '胸部', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_incline_db_press', name: '上斜哑铃卧推', category: 'chest', movementPattern: 'horizontal_push', targetMuscle: '上胸', equipment: 'dumbbell', difficulty: 'intermediate' },
  { id: 'sys_ex_pushup', name: '俯卧撑', category: 'chest', movementPattern: 'horizontal_push', targetMuscle: '胸部', equipment: 'bodyweight', difficulty: 'beginner' },
  { id: 'sys_ex_cable_fly', name: '绳索夹胸', category: 'chest', movementPattern: 'isolation', targetMuscle: '胸部', equipment: 'cable', difficulty: 'beginner' },
  { id: 'sys_ex_dip', name: '双杠臂屈伸', category: 'chest', movementPattern: 'horizontal_push', targetMuscle: '胸部', equipment: 'bodyweight', difficulty: 'intermediate' },
  { id: 'sys_ex_squat', name: '深蹲', category: 'legs', movementPattern: 'squat', targetMuscle: '股四头肌', equipment: 'barbell', difficulty: 'intermediate', notes: '基础下肢主项。' },
  { id: 'sys_ex_front_squat', name: '前蹲', category: 'legs', movementPattern: 'squat', targetMuscle: '股四头肌', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_leg_press', name: '腿举', category: 'legs', movementPattern: 'squat', targetMuscle: '股四头肌', equipment: 'machine', difficulty: 'beginner' },
  { id: 'sys_ex_bulgarian_split_squat', name: '保加利亚分腿蹲', category: 'legs', movementPattern: 'squat', targetMuscle: '股四头肌', equipment: 'dumbbell', difficulty: 'intermediate' },
  { id: 'sys_ex_deadlift', name: '硬拉', category: 'legs', movementPattern: 'hinge', targetMuscle: '后链', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_pause_deadlift', name: '暂停硬拉', category: 'legs', movementPattern: 'hinge', targetMuscle: '后链', equipment: 'barbell', difficulty: 'advanced' },
  { id: 'sys_ex_rdl', name: '罗马尼亚硬拉', category: 'legs', movementPattern: 'hinge', targetMuscle: '腘绳肌', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_leg_curl', name: '腿弯举', category: 'legs', movementPattern: 'hinge', targetMuscle: '腘绳肌', equipment: 'machine', difficulty: 'beginner' },
  { id: 'sys_ex_hip_thrust', name: '臀推', category: 'legs', movementPattern: 'hinge', targetMuscle: '臀部', equipment: 'barbell', difficulty: 'beginner' },
  { id: 'sys_ex_calf_raise', name: '提踵', category: 'calves', movementPattern: 'isolation', targetMuscle: '小腿', equipment: 'machine', difficulty: 'beginner' },
  { id: 'sys_ex_pullup', name: '引体向上', category: 'back', movementPattern: 'vertical_pull', targetMuscle: '背阔肌', equipment: 'bodyweight', difficulty: 'intermediate' },
  { id: 'sys_ex_lat_pulldown', name: '高位下拉', category: 'back', movementPattern: 'vertical_pull', targetMuscle: '背阔肌', equipment: 'machine', difficulty: 'beginner' },
  { id: 'sys_ex_barbell_row', name: '杠铃划船', category: 'back', movementPattern: 'horizontal_pull', targetMuscle: '背部', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_db_row', name: '哑铃划船', category: 'back', movementPattern: 'horizontal_pull', targetMuscle: '背部', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_seated_row', name: '坐姿划船', category: 'back', movementPattern: 'horizontal_pull', targetMuscle: '背部', equipment: 'machine', difficulty: 'beginner' },
  { id: 'sys_ex_face_pull', name: '面拉', category: 'shoulder', movementPattern: 'isolation', targetMuscle: '三角肌后束', equipment: 'cable', difficulty: 'beginner' },
  { id: 'sys_ex_overhead_press', name: '杠铃推举', category: 'shoulder', movementPattern: 'vertical_push', targetMuscle: '肩部', equipment: 'barbell', difficulty: 'intermediate' },
  { id: 'sys_ex_db_shoulder_press', name: '哑铃肩推', category: 'shoulder', movementPattern: 'vertical_push', targetMuscle: '肩部', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_lateral_raise', name: '侧平举', category: 'shoulder', movementPattern: 'isolation', targetMuscle: '三角肌中束', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_reverse_fly', name: '反向飞鸟', category: 'shoulder', movementPattern: 'isolation', targetMuscle: '三角肌后束', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_triceps_pushdown', name: '绳索下压', category: 'arms', movementPattern: 'isolation', targetMuscle: '肱三头肌', equipment: 'cable', difficulty: 'beginner' },
  { id: 'sys_ex_overhead_extension', name: '过顶臂屈伸', category: 'arms', movementPattern: 'isolation', targetMuscle: '肱三头肌', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_db_curl', name: '哑铃弯举', category: 'arms', movementPattern: 'isolation', targetMuscle: '肱二头肌', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_barbell_curl', name: '杠铃弯举', category: 'arms', movementPattern: 'isolation', targetMuscle: '肱二头肌', equipment: 'barbell', difficulty: 'beginner' },
  { id: 'sys_ex_crunch', name: '卷腹', category: 'core', movementPattern: 'core', targetMuscle: '腹直肌', equipment: 'bodyweight', difficulty: 'beginner' },
  { id: 'sys_ex_hanging_leg_raise', name: '悬垂举腿', category: 'core', movementPattern: 'core', targetMuscle: '腹部', equipment: 'bodyweight', difficulty: 'intermediate' },
  { id: 'sys_ex_plank', name: '平板支撑', category: 'core', movementPattern: 'core', targetMuscle: '核心', equipment: 'bodyweight', difficulty: 'beginner' },
  { id: 'sys_ex_pallof_press', name: 'Pallof Press', category: 'core', movementPattern: 'core', targetMuscle: '核心抗旋转', equipment: 'cable', difficulty: 'beginner' },
  { id: 'sys_ex_farmers_walk', name: '农夫行走', category: 'full_body', movementPattern: 'carry', targetMuscle: '全身', equipment: 'dumbbell', difficulty: 'beginner' },
  { id: 'sys_ex_rower_warmup', name: '划船机热身', category: 'full_body', movementPattern: 'other', targetMuscle: '全身', equipment: 'machine', difficulty: 'beginner' },
];

export const systemPlanCatalog: SystemPlanCatalogItem[] = [
  {
    id: 'sys_plan_beginner_full_body',
    name: '新手全身训练计划',
    title: '每周 3 天，动作少、重复高，适合建立训练习惯',
    goal: 'strength',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    description: '围绕深蹲、卧推、硬拉、划船和推举建立基础动作模式，适合刚开始系统训练的用户。',
    tags: ['beginner', 'full_body', 'strength'],
  },
  {
    id: 'sys_plan_classic_ppl',
    name: '经典三分化 PPL',
    title: '推 / 拉 / 腿三天循环，兼顾增肌和基础力量',
    goal: 'hypertrophy',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    description: '按 Push、Pull、Legs 组织训练，适合每周训练 3-6 天的用户。',
    tags: ['ppl', 'hypertrophy'],
  },
  {
    id: 'sys_plan_upper_lower',
    name: '上下肢分化计划',
    title: '每周 4 天，上肢和下肢交替推进',
    goal: 'strength',
    durationWeeks: 8,
    frequencyPerWeek: 4,
    description: '上肢日强化卧推、划船和推举，下肢日强化深蹲、硬拉和单腿训练。',
    tags: ['upper_lower', 'strength'],
  },
  {
    id: 'sys_plan_body_part_split',
    name: '四分化增肌计划',
    title: '胸、背、肩臂、腿分化，适合容量训练',
    goal: 'hypertrophy',
    durationWeeks: 8,
    frequencyPerWeek: 4,
    description: '面向有一定基础的增肌用户，训练容量更高，动作选择更细。',
    tags: ['split', 'hypertrophy'],
  },
  {
    id: 'sys_plan_basic_5x5',
    name: '基础力量 5x5',
    title: '围绕三大项和推举的线性力量计划',
    goal: 'strength',
    durationWeeks: 12,
    frequencyPerWeek: 3,
    description: '用 5x5 主项推进深蹲、卧推、硬拉和推举，适合力量基础期。',
    tags: ['5x5', 'strength'],
  },
  {
    id: 'sys_plan_fat_loss_maintenance',
    name: '减脂保肌训练计划',
    title: '中等容量，保留力量输出并控制疲劳',
    goal: 'maintenance',
    durationWeeks: 6,
    frequencyPerWeek: 3,
    description: '在减脂期保持复合动作和基础训练量，避免过高疲劳影响恢复。',
    tags: ['fat_loss', 'maintenance'],
  },
  {
    id: 'sys_plan_recovery',
    name: '恢复训练计划',
    title: '低强度、低压力，适合回归训练或疲劳期',
    goal: 'recovery',
    durationWeeks: 4,
    frequencyPerWeek: 3,
    description: '降低强度和容量，保留动作练习，帮助用户重新建立节奏。',
    tags: ['recovery'],
  },
  {
    id: 'sys_plan_home_dumbbell',
    name: '家庭哑铃训练计划',
    title: '少器械环境下的全身训练模板',
    goal: 'hypertrophy',
    durationWeeks: 6,
    frequencyPerWeek: 3,
    description: '以哑铃和自重动作为主，适合家庭或器械有限场景。',
    tags: ['home', 'dumbbell'],
  },
];
