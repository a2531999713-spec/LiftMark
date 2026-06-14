// Generated from 四练增力增肌训练计划_完整版2.1.xlsx.
// Manual confirmation needed: inferred exercise category, movementPattern, equipment, and difficulty for slash-combined exercise names.

import type { Exercise } from '@/domain/exercise/exercise.types';

export type ExerciseSeed = Omit<Exercise, 'createdAt' | 'updatedAt'>;

export const defaultExerciseSeeds: ExerciseSeed[] = [
  {
    "id": "ex_001",
    "name": "杠铃卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "notes": "主项，必须做"
  },
  {
    "id": "ex_002",
    "name": "停顿卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "1秒停顿，练底部稳定"
  },
  {
    "id": "ex_003",
    "name": "负重引体",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "可用自重或负重"
  },
  {
    "id": "ex_004",
    "name": "胸托划船/坐姿划船",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "背部支撑卧推"
  },
  {
    "id": "ex_005",
    "name": "上斜哑铃卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "不练爆，避免影响周三"
  },
  {
    "id": "ex_006",
    "name": "面拉/反向飞鸟",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "肩胛稳定"
  },
  {
    "id": "ex_007",
    "name": "绳索下压",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "有余力再做"
  },
  {
    "id": "ex_008",
    "name": "杠铃深蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "notes": "主项，必须做"
  },
  {
    "id": "ex_009",
    "name": "停顿深蹲/前蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "控制底部"
  },
  {
    "id": "ex_010",
    "name": "腿举",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "股四头容量"
  },
  {
    "id": "ex_011",
    "name": "罗马尼亚硬拉",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "不要太重，周四还硬拉"
  },
  {
    "id": "ex_012",
    "name": "腿弯举",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "腘绳肌补充"
  },
  {
    "id": "ex_013",
    "name": "小腿提踵",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "可选"
  },
  {
    "id": "ex_014",
    "name": "腹肌",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "核心稳定"
  },
  {
    "id": "ex_015",
    "name": "卧推容量/窄握卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "技术和容量，不冲重量"
  },
  {
    "id": "ex_016",
    "name": "杠铃/哑铃肩推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "垂直推力量"
  },
  {
    "id": "ex_017",
    "name": "引体/高位下拉",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "背阔肌容量"
  },
  {
    "id": "ex_018",
    "name": "胸托划船/器械划船",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "减少下背压力"
  },
  {
    "id": "ex_019",
    "name": "器械推胸/上斜器械推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "胸部辅助容量"
  },
  {
    "id": "ex_020",
    "name": "侧平举",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "肩侧束"
  },
  {
    "id": "ex_021",
    "name": "弯举",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手臂补充"
  },
  {
    "id": "ex_022",
    "name": "传统硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "硬拉总组数比卧推/深蹲少1组"
  },
  {
    "id": "ex_023",
    "name": "暂停硬拉/膝下硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "技术辅助"
  },
  {
    "id": "ex_024",
    "name": "臀推",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "髋伸补充"
  },
  {
    "id": "ex_025",
    "name": "背伸",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "轻量，不要顶腰"
  },
  {
    "id": "ex_026",
    "name": "保加利亚分腿蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "有余力再做"
  },
  {
    "id": "ex_027",
    "name": "抗旋核心",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "核心稳定"
  },
  {
    "id": "ex_028",
    "name": "按周五补弱菜单选择",
    "category": "other",
    "movementPattern": "other",
    "targetMuscle": "全身",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "不做高强度深蹲/硬拉/卧推"
  },
  {
    "id": "ex_029",
    "name": "器械推胸",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_030",
    "name": "绳索夹胸",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_031",
    "name": "双杠臂屈伸/俯卧撑",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_032",
    "name": "引体向上/负重引体",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "70"
  },
  {
    "id": "ex_033",
    "name": "胸托划船",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_034",
    "name": "高位下拉",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_035",
    "name": "坐姿绳索划船",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_036",
    "name": "直臂下压",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_037",
    "name": "反向飞鸟/面拉",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_038",
    "name": "哑铃弯举",
    "category": "arms",
    "movementPattern": "isolation",
    "targetMuscle": "手臂",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_039",
    "name": "锤式弯举",
    "category": "arms",
    "movementPattern": "isolation",
    "targetMuscle": "手臂",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_040",
    "name": "哑铃/杠铃肩推",
    "category": "shoulder",
    "movementPattern": "vertical_push",
    "targetMuscle": "肩部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "65"
  },
  {
    "id": "ex_041",
    "name": "绳索侧平举",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_042",
    "name": "器械侧平举/哑铃侧平举",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_043",
    "name": "反向蝴蝶机",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_044",
    "name": "面拉",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_045",
    "name": "哑铃耸肩",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_046",
    "name": "过顶臂屈伸/下压",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_047",
    "name": "深蹲/哈克深蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "70"
  },
  {
    "id": "ex_048",
    "name": "腿屈伸",
    "category": "other",
    "movementPattern": "other",
    "targetMuscle": "全身",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_049",
    "name": "坐姿/俯卧腿弯举",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "手动"
  },
  {
    "id": "ex_050",
    "name": "哑铃侧平举",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_051",
    "name": "器械侧平举",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_052",
    "name": "单臂侧平举",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_053",
    "name": "俯身后束飞鸟",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_054",
    "name": "高位绳索后束",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_055",
    "name": "轻划船",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_056",
    "name": "上斜器械推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_057",
    "name": "上斜绳索夹胸",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_058",
    "name": "低到高夹胸",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_059",
    "name": "俯卧撑",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_060",
    "name": "单臂下拉",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_061",
    "name": "窄握下拉",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_062",
    "name": "悬垂",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_063",
    "name": "过顶臂屈伸",
    "category": "arms",
    "movementPattern": "isolation",
    "targetMuscle": "手臂",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_064",
    "name": "牧师凳弯举",
    "category": "arms",
    "movementPattern": "isolation",
    "targetMuscle": "手臂",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_065",
    "name": "反握下压/腕屈伸",
    "category": "arms",
    "movementPattern": "isolation",
    "targetMuscle": "手臂",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_066",
    "name": "轻罗马尼亚硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_067",
    "name": "臀中肌外展",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_068",
    "name": "悬垂举腿",
    "category": "core",
    "movementPattern": "core",
    "targetMuscle": "核心",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_069",
    "name": "绳索卷腹",
    "category": "core",
    "movementPattern": "core",
    "targetMuscle": "核心",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_070",
    "name": "Pallof",
    "category": "core",
    "movementPattern": "core",
    "targetMuscle": "核心",
    "equipment": "cable",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_071",
    "name": "死虫",
    "category": "core",
    "movementPattern": "core",
    "targetMuscle": "核心",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_072",
    "name": "平板支撑",
    "category": "core",
    "movementPattern": "core",
    "targetMuscle": "核心",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "来自周五补弱菜单"
  },
  {
    "id": "ex_077",
    "name": "哑铃卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "保持水平推模式"
  },
  {
    "id": "ex_078",
    "name": "史密斯卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "smith",
    "difficulty": "intermediate",
    "notes": "保持水平推模式"
  },
  {
    "id": "ex_079",
    "name": "Spoto Press",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "notes": "控制底部，不弹胸"
  },
  {
    "id": "ex_080",
    "name": "窄握卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "控制底部，不弹胸"
  },
  {
    "id": "ex_081",
    "name": "轻重量普通卧推",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "控制底部，不弹胸"
  },
  {
    "id": "ex_082",
    "name": "哈克深蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "增力期优先保留杠铃深蹲"
  },
  {
    "id": "ex_083",
    "name": "史密斯深蹲",
    "category": "legs",
    "movementPattern": "squat",
    "targetMuscle": "腿部",
    "equipment": "smith",
    "difficulty": "intermediate",
    "notes": "增力期优先保留杠铃深蹲"
  },
  {
    "id": "ex_084",
    "name": "架上拉",
    "category": "other",
    "movementPattern": "other",
    "targetMuscle": "全身",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "下背疲劳时减少总量"
  },
  {
    "id": "ex_085",
    "name": "陷阱杠硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "下背疲劳时减少总量"
  },
  {
    "id": "ex_086",
    "name": "相扑硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "下背疲劳时减少总量"
  },
  {
    "id": "ex_087",
    "name": "哑铃罗马尼亚硬拉",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "不要顶腰"
  },
  {
    "id": "ex_088",
    "name": "坐姿划船",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "下背累时优先胸托"
  },
  {
    "id": "ex_089",
    "name": "器械划船",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "下背累时优先胸托"
  },
  {
    "id": "ex_090",
    "name": "单臂哑铃划船",
    "category": "back",
    "movementPattern": "horizontal_pull",
    "targetMuscle": "背部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "下背累时优先胸托"
  },
  {
    "id": "ex_091",
    "name": "引体向上",
    "category": "back",
    "movementPattern": "vertical_pull",
    "targetMuscle": "背部",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "notes": "下拉到上胸附近"
  },
  {
    "id": "ex_092",
    "name": "肩推",
    "category": "shoulder",
    "movementPattern": "vertical_push",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "肩不适时减少幅度"
  },
  {
    "id": "ex_093",
    "name": "哑铃肩推",
    "category": "shoulder",
    "movementPattern": "vertical_push",
    "targetMuscle": "肩部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "肩不适时减少幅度"
  },
  {
    "id": "ex_094",
    "name": "器械肩推",
    "category": "shoulder",
    "movementPattern": "vertical_push",
    "targetMuscle": "肩部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "肩不适时减少幅度"
  },
  {
    "id": "ex_095",
    "name": "史密斯肩推",
    "category": "shoulder",
    "movementPattern": "vertical_push",
    "targetMuscle": "肩部",
    "equipment": "smith",
    "difficulty": "intermediate",
    "notes": "肩不适时减少幅度"
  },
  {
    "id": "ex_096",
    "name": "坐姿腿弯举",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "控制离心"
  },
  {
    "id": "ex_097",
    "name": "俯卧腿弯举",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "控制离心"
  },
  {
    "id": "ex_098",
    "name": "瑞士球腿弯举",
    "category": "legs",
    "movementPattern": "hinge",
    "targetMuscle": "后链",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "控制离心"
  },
  {
    "id": "ex_099",
    "name": "蝴蝶机夹胸",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "machine",
    "difficulty": "intermediate",
    "notes": "不要追求过重"
  },
  {
    "id": "ex_100",
    "name": "哑铃飞鸟",
    "category": "chest",
    "movementPattern": "horizontal_push",
    "targetMuscle": "胸部",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "notes": "不要追求过重"
  },
  {
    "id": "ex_101",
    "name": "高位后束飞鸟",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "轻重量控制"
  },
  {
    "id": "ex_102",
    "name": "弹力带面拉",
    "category": "shoulder",
    "movementPattern": "isolation",
    "targetMuscle": "肩部",
    "equipment": "other",
    "difficulty": "intermediate",
    "notes": "轻重量控制"
  }
];
