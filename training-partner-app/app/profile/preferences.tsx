import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { MemberProfile } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, spacing } from '@/theme';

function fridayStrategyLabel(strategy?: Group['fridayStrategy']) {
  if (strategy === 'allow_weak') return '允许补弱';
  if (strategy === 'allow_free') return '允许自由训练';
  return '默认休息';
}

export default function ProfilePreferencesRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [group, setGroup] = useState<Group | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) throw new Error('默认小组尚未初始化。');
      const members = await repositories.memberRepository.listMembers(nextGroup.id);
      setGroup(nextGroup);
      setProfile(members[0] ? await repositories.memberRepository.getMemberProfile(members[0].id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '偏好加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen safeTop={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <SettingsRow label="默认单位" value="kg" />
            <SettingsRow label="杠铃加重单位" value={`${profile?.barbellIncrement ?? 2.5} kg`} />
            <SettingsRow label="哑铃加重单位" value={`${profile?.dumbbellIncrement ?? 2.5} kg`} />
            <SettingsRow label="默认记录方式" value="重量 / 次数" />
            <SettingsRow label="休息计时" right={<Tag label="开启" tone="success" />} />
            <SettingsRow label="周五策略" value={fridayStrategyLabel(group?.fridayStrategy)} />
          </AppCard>

          <AppButton
            onPress={() => {
              if (guardFeature('start_workout')) router.push('/settings/member-units' as never);
            }}
            variant="secondary"
          >
            编辑加重单位
          </AppButton>

          <AppCard style={styles.card} tone="soft">
            <AppText variant="bodySmall" weight="900">
              更多设置即将开放
            </AppText>
            <AppText tone="muted" variant="caption">
              外观、语言和通知设置将在后续版本中开放。
            </AppText>
          </AppCard>
        </>
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
});
