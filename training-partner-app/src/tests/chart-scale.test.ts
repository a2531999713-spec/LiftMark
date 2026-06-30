import { describe, expect, it } from '@jest/globals';

import { buildYAxisScale, normalizeYAxisValue } from '@/components/ui/chartScale';

describe('buildYAxisScale', () => {
  it('keeps equal positive values inside a padded readable range', () => {
    const scale = buildYAxisScale([120, 120, 120], { includeZero: false, tickCount: 3 });

    expect(scale.minValue).toBeLessThan(120);
    expect(scale.maxValue).toBeGreaterThan(120);
    expect(scale.ticks).toHaveLength(3);
    expect(normalizeYAxisValue(120, scale)).toBeGreaterThan(0);
    expect(normalizeYAxisValue(120, scale)).toBeLessThan(1);
  });

  it('uses a real shared axis for multi-line values', () => {
    const scale = buildYAxisScale([0, 1000, 2200, 4500], { includeZero: true, tickCount: 4 });

    expect(scale.minValue).toBe(0);
    expect(scale.maxValue).toBeGreaterThanOrEqual(4500);
    expect(normalizeYAxisValue(1000, scale)).toBeLessThan(normalizeYAxisValue(4500, scale));
  });

  it('handles empty and zero-only charts without collapsing the range', () => {
    const scale = buildYAxisScale([0, Number.NaN], { includeZero: true, tickCount: 3 });

    expect(scale.minValue).toBe(0);
    expect(scale.range).toBeGreaterThan(0);
    expect(scale.ticks).toHaveLength(3);
    expect(normalizeYAxisValue(0, scale)).toBe(0);
  });
});
