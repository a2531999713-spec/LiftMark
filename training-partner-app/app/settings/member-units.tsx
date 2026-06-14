import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

type MemberUnitRow = {
  member: GroupMember;
  profile: MemberProfile | null;
};

function formatIncrement(value: number | undefined, fallback: number): string {
  return `${value ?? fallback}kg`;
}

export default function SettingsMemberUnitsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [rows, setRows] = useState<MemberUnitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const group = await repositories.groupRepository.getDefaultGroup();
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }

      const members = await repositories.memberRepository.listMembers(group.id);
      const nextRows = await Promise.all(
        members.map(async (member) => ({
          member,
          profile: await repositories.memberRepository.getMemberProfile(member.id),
        })),
      );
      setRows(nextRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加重单位加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadRows();
    }, [loadRows]),
  );

  return (
    <Screen title="加重单位" subtitle="杠铃和哑铃加重单位按成员分别设置。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="加重单位暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.summaryCard} tone="brand">
            <AppText variant="subtitle">选择成员后编辑</AppText>
            <AppText tone="muted" variant="bodySmall">
              点击“加重单位”不会默认跳转第一个成员；先在这里选择要编辑的人。
            </AppText>
          </AppCard>

          {rows.length === 0 ? (
            <EmptyState title="还没有成员" description="添加成员后可以分别设置杠铃和哑铃加重单位。" />
          ) : (
            <View style={styles.list}>
              {rows.map(({ member, profile }) => (
                <Pressable
                  accessibilityRole="button"
                  key={member.id}
                  onPress={() => router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } })}
                  style={({ pressed }) => [styles.unitCard, pressed && styles.pressed]}
                >
                  <View style={styles.iconBox}>
                    <Ionicons color={colors.primary} name="barbell-outline" size={19} />
                  </View>
                  <View style={styles.unitText}>
                    <AppText variant="bodySmall" weight="900">
                      {member.displayName}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      杠铃 {formatIncrement(profile?.barbellIncrement, 2.5)} / 哑铃{' '}
                      {formatIncrement(profile?.dumbbellIncrement, 2)}
                    </AppText>
                  </View>
                  <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  list: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  summaryCard: {
    gap: spacing.sm,
  },
  unitCard: {
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
  unitText: {
    flex: 1,
    gap: 2,
  },
});
