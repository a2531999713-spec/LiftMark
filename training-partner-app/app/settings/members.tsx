import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { MAX_GROUP_MEMBERS } from '@/domain/member/member.validation';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type MemberWithProfile = {
  member: GroupMember;
  profile: MemberProfile | null;
};

function formatProfileSummary(profile: MemberProfile | null): string {
  if (!profile) {
    return '资料待补充';
  }

  const lifts = [
    profile.bench1RM ? '卧推' : null,
    profile.squat1RM ? '深蹲' : null,
    profile.deadlift1RM ? '硬拉' : null,
    profile.overheadPress1RM ? '肩推' : null,
  ].filter(Boolean);

  return lifts.length > 0 ? `已填写 ${lifts.length} 项 1RM` : '1RM 待补充';
}

export default function SettingsMembersRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [items, setItems] = useState<MemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }
      if (group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }

      const members = await repositories.memberRepository.listMembers(group.id);
      const profiles = await Promise.all(
        members.map(async (member) => ({
          member,
          profile: await repositories.memberRepository.getMemberProfile(member.id),
        })),
      );
      setItems(profiles);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '成员资料加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const canAddMember = items.length < MAX_GROUP_MEMBERS;

  return (
    <Screen safeTop={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="成员资料暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.summaryCard} tone="brand">
            <AppText variant="subtitle">{items.length} 位成员</AppText>
            <AppText tone="muted" variant="bodySmall">
              成员资料、1RM 和加重单位按成员分别维护，不作为全局设置。
            </AppText>
          </AppCard>

          {items.length === 0 ? (
            <EmptyState
              actionLabel="新增成员"
              description="添加成员后，设置页会显示全部成员摘要。"
              onActionPress={() => {
                if (guardFeature('add_member', { memberCount: items.length })) {
                  router.push({ pathname: '/member/new', params: { returnTo: 'settings' } });
                }
              }}
              title="还没有成员"
            />
          ) : (
            <View style={styles.list}>
              {items.map(({ member, profile }) => (
                <Pressable
                  accessibilityRole="button"
                  key={member.id}
                  onPress={() => {
                    if (guardFeature('start_workout')) {
                      router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } });
                    }
                  }}
                  style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}
                >
                  <Avatar
                    avatarLocalUri={profile?.avatarLocalUri}
                    avatarThumbUrl={profile?.avatarThumbUrl}
                    avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
                    name={member.displayName}
                    size={38}
                  />
                  <View style={styles.memberText}>
                    <AppText variant="bodySmall" weight="900">
                      {member.displayName}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      {formatProfileSummary(profile)}
                    </AppText>
                  </View>
                  <Tag label={member.role === 'owner' ? '组长' : '成员'} tone={member.role === 'owner' ? 'brand' : 'neutral'} />
                  <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                </Pressable>
              ))}
            </View>
          )}

          {canAddMember ? (
            <AppButton
              icon="person-add-outline"
              onPress={() => {
                if (guardFeature('add_member', { memberCount: items.length })) {
                  router.push({ pathname: '/member/new', params: { returnTo: 'settings' } });
                }
              }}
              variant="secondary"
            >
              新增成员
            </AppButton>
          ) : (
            <AppCard style={styles.limitCard} tone="soft">
              <AppText variant="bodySmall" weight="900">
                小组最多支持 {MAX_GROUP_MEMBERS} 位训练成员
              </AppText>
              <AppText tone="muted" variant="caption">
                适合一台设备多人轮换记录。多设备小组能力后续版本开放。
              </AppText>
            </AppCard>
          )}
        </>
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  memberText: {
    flex: 1,
    gap: 2,
  },
  limitCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  summaryCard: {
    gap: spacing.sm,
  },
});
