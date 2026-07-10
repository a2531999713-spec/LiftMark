import { act, renderHook } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { useAuthGate } from '@/hooks/useAuthGate';

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { authMode: 'logged_in_free' }) => unknown) =>
    selector({ authMode: 'logged_in_free' }),
}));

describe('useAuthGate', () => {
  it('clears an old Pro prompt when the next feature is allowed', () => {
    const { result } = renderHook(() => useAuthGate());

    act(() => {
      expect(result.current.guardFeature('advanced_history')).toBe(false);
    });
    expect(result.current.sheets.proPrompt?.reason).toBe('pro_required');

    act(() => {
      expect(result.current.guardFeature('import_plan')).toBe(true);
    });
    expect(result.current.sheets.authPrompt).toBeNull();
    expect(result.current.sheets.noticePrompt).toBeNull();
    expect(result.current.sheets.proPrompt).toBeNull();
  });
});
