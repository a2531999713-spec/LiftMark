import type { HistoryListItem } from '@/domain/history/history.types';

export function buildRecordHomeInsights(items: HistoryListItem[], scope: 'personal' | 'group'): string[] {
  if (items.length < 2) {
    return ['当前训练样本较少。', '完成更多训练后，可生成稳定的趋势判断。'];
  }
  const totalSets = items.reduce((sum, item) => sum + item.completedSets, 0);
  const totalVolume = items.reduce((sum, item) => sum + item.totalVolume, 0);
  const peak = items.reduce((best, item) => item.totalVolume > best.totalVolume ? item : best, items[0]);
  const exerciseCounts = new Map<string, number>();
  items.forEach((item) => item.mainExerciseNames.forEach((name) => exerciseCounts.set(name, (exerciseCounts.get(name) ?? 0) + 1)));
  const frequentExercise = [...exerciseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const prefix = scope === 'personal' ? '当前范围完成' : '小组当前范围完成';
  return [
    `${prefix} ${items.length} 次训练，共 ${totalSets} 个完成组。`,
    `累计训练量 ${Math.round(totalVolume).toLocaleString('zh-CN')} kg，峰值出现在 ${peak.date}。`,
    frequentExercise ? `${frequentExercise} 是当前记录最多的动作。` : '继续记录训练动作，可生成动作表现提示。',
  ];
}

export function buildHistoryTrendInsight(items: HistoryListItem[]): string {
  if (items.length < 2) return '完成更多训练后可生成趋势判断';
  const total = items.reduce((sum, item) => sum + item.totalVolume, 0);
  const peak = items.reduce((best, item) => (item.totalVolume > best.totalVolume ? item : best), items[0]);
  const recent = items.slice(0, Math.ceil(items.length / 2)).reduce((sum, item) => sum + item.totalVolume, 0);
  const earlier = Math.max(1, total - recent);
  const direction = recent >= earlier ? '近期训练量较前一阶段上升或持平' : '近期训练量较前一阶段下降';
  return `${direction}；本周期共 ${items.length} 次训练，最高训练量出现在 ${peak.date}。`;
}
