import { describe, expect, it } from '@jest/globals';

import { formatAchievementValue } from '@/features/achievements/achievementPresentation';

describe('achievement presentation', () => {
  it('formats compact kilograms and converts display-only pounds', () => {
    expect(formatAchievementValue(860, 'total_volume')).toBe('860 kg');
    expect(formatAchievementValue(12_400, 'total_volume')).toBe('12k kg');
    expect(formatAchievementValue(1000, 'total_volume', 'lb')).toBe('2.2k lb');
  });
});
