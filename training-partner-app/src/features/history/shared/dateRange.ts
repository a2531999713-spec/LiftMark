export type DateRangePreset = '7d' | '30d' | 'month' | 'custom';

export type DateRangeValue = {
  fromDate: string;
  preset: DateRangePreset;
  title: string;
  toDate: string;
};

export type DateRangeOption = {
  label: string;
  preset: DateRangePreset;
};

export const defaultDateRangeOptions: DateRangeOption[] = [
  { label: '最近7天', preset: '7d' },
  { label: '最近30天', preset: '30d' },
  { label: '本月', preset: 'month' },
  { label: '自定义', preset: 'custom' },
];

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function getDateSpanDays(fromDate: string, toDate: string): number {
  const start = parseLocalDate(fromDate).getTime();
  const end = parseLocalDate(toDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 1;
  }
  return Math.floor((end - start) / 86400000) + 1;
}

export function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

export function formatFullDate(date: string): string {
  return date.replaceAll('-', '/');
}

export function formatRangeLabel(fromDate: string, toDate: string): string {
  return `${formatFullDate(fromDate)} - ${formatFullDate(toDate)}`;
}

export function getWeekdayLabel(date: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return labels[parseLocalDate(date).getDay()];
}

export function createDateRange(
  preset: DateRangePreset,
  customRange?: Pick<DateRangeValue, 'fromDate' | 'toDate'> | null,
  today = new Date(),
): DateRangeValue {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);

  if (preset === 'custom' && customRange) {
    return {
      fromDate: customRange.fromDate,
      preset,
      title: '当前范围',
      toDate: customRange.toDate,
    };
  }

  if (preset === 'month') {
    return {
      fromDate: getLocalDateString(new Date(end.getFullYear(), end.getMonth(), 1, 12)),
      preset,
      title: '本月',
      toDate: getLocalDateString(new Date(end.getFullYear(), end.getMonth() + 1, 0, 12)),
    };
  }

  const days = preset === '7d' ? 7 : 30;
  return {
    fromDate: getLocalDateString(addDays(end, -(days - 1))),
    preset,
    title: preset === '7d' ? '近7天' : '近30天',
    toDate: getLocalDateString(end),
  };
}

export function getPresetTitle(range: DateRangeValue): string {
  if (range.preset === '7d') return '近7天';
  if (range.preset === '30d') return '近30天';
  if (range.preset === 'month') return '本月';
  return '当前范围';
}

export type TrendBucket = {
  endDate: string;
  key: string;
  label: string;
  startDate: string;
};

export function buildTrendBuckets(fromDate: string, toDate: string): TrendBucket[] {
  const span = getDateSpanDays(fromDate, toDate);
  const start = parseLocalDate(fromDate);

  if (span <= 14) {
    return Array.from({ length: span }, (_, index) => {
      const date = getLocalDateString(addDays(start, index));
      return { endDate: date, key: date, label: formatShortDate(date), startDate: date };
    });
  }

  const buckets: TrendBucket[] = [];
  for (let offset = 0; offset < span; offset += 7) {
    const bucketStart = getLocalDateString(addDays(start, offset));
    const bucketEnd = getLocalDateString(addDays(start, Math.min(span - 1, offset + 6)));
    buckets.push({
      endDate: bucketEnd,
      key: `${bucketStart}:${bucketEnd}`,
      label: formatShortDate(bucketStart),
      startDate: bucketStart,
    });
  }

  return buckets;
}

export function findBucketForDate(buckets: TrendBucket[], date: string): TrendBucket | undefined {
  return buckets.find((bucket) => date >= bucket.startDate && date <= bucket.endDate);
}

export function buildRecentDates(fromDate: string, toDate: string, maxCount = 12): string[] {
  const span = getDateSpanDays(fromDate, toDate);
  const startOffset = Math.max(0, span - maxCount);
  const start = parseLocalDate(fromDate);
  return Array.from({ length: Math.min(span, maxCount) }, (_, index) => getLocalDateString(addDays(start, startOffset + index)));
}
