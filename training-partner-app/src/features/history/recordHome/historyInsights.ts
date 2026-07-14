import type { HistoryListItem } from '@/domain/history/history.types';

export function buildHistoryTrendInsight(items: HistoryListItem[]): string {
  if (items.length < 2) return '完成更多训练后可生成趋势判断';
  const total = items.reduce((sum, item) => sum + item.totalVolume, 0);
  const peak = items.reduce((best, item) => (item.totalVolume > best.totalVolume ? item : best), items[0]);
  const recent = items.slice(0, Math.ceil(items.length / 2)).reduce((sum, item) => sum + item.totalVolume, 0);
  const earlier = Math.max(1, total - recent);
  const direction = recent >= earlier ? '近期训练量较前一阶段上升或持平' : '近期训练量较前一阶段下降';
  return `${direction}；本周期共 ${items.length} 次训练，最高训练量出现在 ${peak.date}。`;
}
