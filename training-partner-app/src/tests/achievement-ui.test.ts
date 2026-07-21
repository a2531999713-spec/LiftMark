/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { AchievementMetrics, AchievementSnapshot } from '@liftmark/shared';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { evaluateAchievements } from '@/domain/achievement/achievement-engine';
import { AchievementContinuityCard } from '@/features/achievements/AchievementContinuityCard';
import { AchievementSummaryCard } from '@/features/achievements/AchievementSummaryCard';

const metrics: AchievementMetrics = {
  completedWorkouts: 17,
  totalVolume: 12_000,
  groupWorkouts: 1,
  completedCycles: 1,
  recoveryCheckins: 3,
  currentActiveWeekStreak: 4,
  longestActiveWeekStreak: 8,
  thisWeekWorkoutCount: 2,
  lastWorkoutDate: '2026-07-20',
};

const snapshot: AchievementSnapshot = {
  metrics,
  achievements: evaluateAchievements(metrics),
  activityWeeks: [],
  generatedAt: '2026-07-20T08:00:00.000Z',
};

describe('achievement UI', () => {
  it('shows the compact home continuity summary and opens the center', () => {
    const onPress = jest.fn();
    const view = render(React.createElement(AchievementContinuityCard, { snapshot, onPress }));
    expect(view.getByText('本周已训练 2 次 · 连续活跃 4 周')).toBeTruthy();
    expect(view.getByText(/形成节奏/)).toBeTruthy();
    fireEvent.press(view.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the four continuity metrics without hiding zero states', () => {
    const view = render(React.createElement(AchievementSummaryCard, { metrics: { ...metrics, thisWeekWorkoutCount: 0 } }));
    expect(view.getByText('本周训练')).toBeTruthy();
    expect(view.getAllByText('0').length).toBeGreaterThan(0);
    expect(view.getByText('累计完成')).toBeTruthy();
  });
});
