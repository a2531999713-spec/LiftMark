// 用户训练偏好类型定义
// 这些字段会持久化到本地 SQLite，并通过 settings 同步通道上云

export type WeightUnit = 'kg' | 'lb';

// 默认记录对象：小组成员（含自己）或仅自己
export type DefaultRecordTarget = 'group_members' | 'self_only';

// 默认训练模式：完整动作 / 精简辅助（A+B）/ 只做主项（A）
export type DefaultTrainingMode = 'full' | 'simplified' | 'main_only';

// 加重步进选项
export type WeightIncrement = '1.25kg' | '2.5kg' | '5kg';

// RPE / RIR 展示策略
export type EffortDisplay = 'none' | 'rpe' | 'rir';

export interface UserPreferences {
  id: string;
  weightUnit: WeightUnit;
  defaultRecordTarget: DefaultRecordTarget;
  restTimerEnabled: boolean;
  defaultTrainingMode: DefaultTrainingMode;
  weightIncrement: WeightIncrement;
  effortDisplay: EffortDisplay;
  createdAt: string;
  updatedAt: string;
}

export type UpsertUserPreferencesInput = {
  weightUnit: WeightUnit;
  defaultRecordTarget: DefaultRecordTarget;
  restTimerEnabled: boolean;
  defaultTrainingMode: DefaultTrainingMode;
  weightIncrement: WeightIncrement;
  effortDisplay: EffortDisplay;
};

// 默认偏好，用于首次初始化或读取失败兜底
export const defaultUserPreferences: UserPreferences = {
  id: 'default',
  weightUnit: 'kg',
  defaultRecordTarget: 'group_members',
  restTimerEnabled: true,
  defaultTrainingMode: 'full',
  weightIncrement: '2.5kg',
  effortDisplay: 'none',
  createdAt: '',
  updatedAt: '',
};

// 将重量步进字符串解析为数值（kg）
export function parseIncrementKg(increment: WeightIncrement): number {
  switch (increment) {
    case '1.25kg':
      return 1.25;
    case '5kg':
      return 5;
    case '2.5kg':
    default:
      return 2.5;
  }
}

// kg <-> lb 转换辅助
export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

// 根据偏好格式化重量显示
export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === 'lb') {
    return `${Math.round(kgToLb(kg) * 10) / 10}lb`;
  }
  return `${Math.round(kg * 10) / 10}kg`;
}
