import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppText, EmptyState, Screen, SecondaryPageHeader, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';
import type { MemberProfile } from '@/domain/member/member.types';
import type { UserPreferences } from '@/domain/preferences/user-preferences.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, spacing } from '@/theme';

function fridayStrategyLabel(strategy?: Group['fridayStrategy']) {
  if (strategy === 'allow_weak') return '允许补弱';
  if (strategy === 'allow_free') return '允许自由训练';
  return '默认休息';
}

export default function ProfilePreferencesRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const { group: nextGroup } = await resolveSelectedGroup(repositories.groupRepository, selectedGroupId);
      if (!nextGroup) throw new Error('默认小组尚未初始化。');
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
      }
      const members = await repositories.memberRepository.listMembers(nextGroup.id);
      const member = resolveDefaultTrainingMember(members);
      const [nextProfile, nextPreferences] = await Promise.all([
        member ? repositories.memberRepository.getMemberProfile(member.id) : Promise.resolve(null),
        repositories.userPreferencesRepository.getPreferences(),
      ]);
      setGroup(nextGroup);
      setProfile(nextProfile);
      setPreferences(nextPreferences);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '偏好加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const weightUnitLabel = preferences?.weightUnit === 'lb' ? 'lb' : 'kg';
  const recordTargetLabel = preferences?.defaultRecordTarget === 'self_only' ? '仅我记录' : '小组成员';
  const trainingModeLabel =
    preferences?.defaultTrainingMode === 'main_only'
      ? '只做主项'
      : preferences?.defaultTrainingMode === 'simplified'
        ? '精简辅助'
        : '完整动作';
  const effortLabel =
    preferences?.effortDisplay === 'rpe'
      ? '展示 RPE'
      : preferences?.effortDisplay === 'rir'
        ? '展示 RIR'
        : '不展示';

  return (
    <Screen safeTop={false}>
      <SecondaryPageHeader
        caption="训练偏好"
        icon="barbell-outline"
        subtitle="单位、记录方式、休息计时和加重单位。"
        title="训练偏好"
      />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <SettingsRow label="训练提醒" value="设置训练日与本机通知" />
            <SettingsRow label="默认单位" value={weightUnitLabel} />
            <SettingsRow label="杠铃加重单位" value={`${profile?.barbellIncrement ?? 2.5} kg`} />
            <SettingsRow label="哑铃加重单位" value={`${profile?.dumbbellIncrement ?? 2.5} kg`} />
            <SettingsRow label="加重步进（偏好）" value={preferences?.weightIncrement ?? '2.5kg'} />
            <SettingsRow label="默认记录对象" value={recordTargetLabel} />
            <SettingsRow
              label="休息计时"
              right={<Tag label={preferences?.restTimerEnabled ? '开启' : '关闭'} tone={preferences?.restTimerEnabled ? 'success' : 'neutral'} />}
            />
            <SettingsRow label="默认训练模式" value={trainingModeLabel} />
            <SettingsRow label="RPE / RIR" value={effortLabel} />
            <SettingsRow label="周五策略" value={fridayStrategyLabel(group?.fridayStrategy)} />
          </AppCard>

          <AppButton icon="notifications-outline" onPress={() => router.push('/profile/training-reminders' as never)} variant="secondary">
            设置训练提醒
          </AppButton>

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
              偏好已持久化并支持云同步
            </AppText>
            <AppText tone="muted" variant="caption">
              在「我的 → 训练偏好」面板中切换的选项会即时保存到本机，并在登录后自动上传服务器。
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
