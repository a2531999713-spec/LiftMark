import { beforeEach, describe, expect, it } from '@jest/globals';

import { useSelectedGroupStore } from '@/store/selectedGroupStore';

// Zustand store 是单例，每个用例前重置状态以避免互相影响。
function resetStore() {
  useSelectedGroupStore.setState({
    activeUserScope: '__anonymous__',
    selectedGroupId: undefined,
    selectedGroupIdsByScope: {},
  });
}

describe('useSelectedGroupStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // 测试 3：创建小组后 selectedGroupId 应该更新
  it('setSelectedGroupId writes the selection into the active scope and exposes it synchronously', () => {
    // 模拟登录：切换到 usr_a scope
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    expect(useSelectedGroupStore.getState().activeUserScope).toBe('usr_a');

    // 创建小组后调用 setSelectedGroupId 写入新 group
    useSelectedGroupStore.getState().setSelectedGroupId('group_new');

    const state = useSelectedGroupStore.getState();
    expect(state.selectedGroupId).toBe('group_new');
    expect(state.selectedGroupIdsByScope.usr_a).toBe('group_new');
  });

  it('clearSelectedGroupId removes the selection from the active scope', () => {
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    useSelectedGroupStore.getState().setSelectedGroupId('group_a');
    useSelectedGroupStore.getState().clearSelectedGroupId();

    const state = useSelectedGroupStore.getState();
    expect(state.selectedGroupId).toBeUndefined();
    expect(state.selectedGroupIdsByScope.usr_a).toBeUndefined();
  });

  it('switchAccountScope restores the previously saved selection for that scope instead of wiping it', () => {
    // 账号 A 选择 group_a
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    useSelectedGroupStore.getState().setSelectedGroupId('group_a');

    // 切换到账号 B：B 没有已保存选择，selectedGroupId 应为 undefined
    useSelectedGroupStore.getState().switchAccountScope('usr_b');
    expect(useSelectedGroupStore.getState().selectedGroupId).toBeUndefined();

    // 账号 B 选择 group_b
    useSelectedGroupStore.getState().setSelectedGroupId('group_b');
    expect(useSelectedGroupStore.getState().selectedGroupIdsByScope.usr_b).toBe('group_b');

    // 切回账号 A：应恢复 group_a，而不是被账号 B 的选择覆盖或被清空
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    const state = useSelectedGroupStore.getState();
    expect(state.selectedGroupId).toBe('group_a');
    expect(state.selectedGroupIdsByScope.usr_a).toBe('group_a');
    expect(state.selectedGroupIdsByScope.usr_b).toBe('group_b');
  });

  it('switchAccountScope with no userId falls back to anonymous scope', () => {
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    useSelectedGroupStore.getState().setSelectedGroupId('group_a');

    // 退出登录：切到匿名 scope，匿名 scope 之前没有保存选择
    useSelectedGroupStore.getState().switchAccountScope(undefined);
    expect(useSelectedGroupStore.getState().activeUserScope).toBe('__anonymous__');
    expect(useSelectedGroupStore.getState().selectedGroupId).toBeUndefined();

    // 账号 A 的选择仍被保留，重新登录可恢复
    useSelectedGroupStore.getState().switchAccountScope('usr_a');
    expect(useSelectedGroupStore.getState().selectedGroupId).toBe('group_a');
  });
});
