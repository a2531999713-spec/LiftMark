import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth/AuthGateSheets';
import { AppButton, AppModalSheet, AppText, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { getSystemTrainingSchemeById } from '@/domain/plan/systemSchemes';
import { SystemSchemeDetailContent } from '@/features/plan-library/SystemSchemeDetailContent';
import {
  copyAndActivateSystemScheme,
  createSystemSchemeCopyActionLock,
  findExistingSystemSchemeCopy,
} from '@/features/plan-library/systemSchemeCopyService';
import { loadSystemSchemePreview, type SystemSchemePreview } from '@/features/plan-library/systemSchemePreview';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ensureTrainingGroupMainline } from '@/services/trainingMainlineService';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, spacing } from '@/theme';

type CopyAction = 'copy' | 'copy_edit';

export default function SystemSchemeDetailRoute() {
  const { schemeId } = useLocalSearchParams<{ schemeId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const scheme = useMemo(() => schemeId ? getSystemTrainingSchemeById(schemeId) : undefined, [schemeId]);
  const { guardFeature, sheets } = useAuthGate();
  const user = useAuthStore((state) => state.user);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [preview, setPreview] = useState<SystemSchemePreview | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [copyAction, setCopyAction] = useState<CopyAction | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<CopyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const copyLock = useRef(createSystemSchemeCopyActionLock()).current;

  const load = useCallback(async () => {
    if (!scheme) { setError('未找到该系统训练方案。'); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const [nextPreview, plans] = await Promise.all([
        loadSystemSchemePreview(repositories, scheme),
        repositories.planRepository.listUserPlans(),
      ]);
      setPreview(nextPreview);
      setUserPlans(plans);
      setSelectedWeek(nextPreview.weeks[0]?.week ?? 1);
    } catch (loadError) {
      setPreview(null);
      setError(loadError instanceof Error ? loadError.message : '方案详情加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, scheme]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const existingPlan = scheme ? findExistingSystemSchemeCopy(userPlans, scheme.id) : undefined;

  const runCopy = useCallback(async (action: CopyAction, allowDuplicate = false) => {
    if (!scheme || copyLock.isPending()) return;
    if ((!existingPlan || allowDuplicate) && !guardFeature('create_plan', { userPlanCount: userPlans.length })) return;
    await copyLock.run(async () => {
      setCopyAction(action);
      try {
        const { group } = await ensureTrainingGroupMainline(repositories, {
          displayName: user?.displayName,
          selectedGroupId,
          userId: user?.id,
        });
        setSelectedGroupId(group.id);
        const result = await copyAndActivateSystemScheme(repositories, {
          allowDuplicate,
          group,
          scheme,
          userPlans,
        });
        setUserPlans((current) => current.some((plan) => plan.id === result.plan.id) ? current : [result.plan, ...current]);
        if (action === 'copy_edit') {
          router.replace({ pathname: '/plan/edit/[planId]', params: { planId: result.plan.id } } as never);
        } else {
          router.replace('/(tabs)/plan' as never);
        }
      } catch (copyError) {
        setActionError(copyError instanceof Error ? copyError.message : '复制系统方案失败。');
      } finally {
        setCopyAction(null);
        setDuplicateAction(null);
      }
    });
  }, [copyLock, existingPlan, guardFeature, repositories, scheme, selectedGroupId, setSelectedGroupId, user, userPlans]);

  const requestCopy = (action: CopyAction) => {
    void runCopy(action);
  };

  return (
    <Screen title="计划详情" subtitle={scheme?.title ?? '系统训练方案'}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="计划详情暂时无法加载" description={error} actionLabel="重试" onActionPress={() => void load()} /> : null}
      {!isLoading && preview ? (
        <>
          <SystemSchemeDetailContent onSelectWeek={setSelectedWeek} preview={preview} selectedWeek={selectedWeek} />
          <View style={styles.actions}>
            {existingPlan ? (
              <AppText tone="success" variant="caption">这套方案已复制到“我的计划”：{existingPlan.name}</AppText>
            ) : null}
            <AppButton
              disabled={preview.availability !== 'ready'}
              loading={copyAction === 'copy'}
              onPress={() => requestCopy('copy')}
            >
              {existingPlan ? '打开并设为当前计划' : '复制到我的计划'}
            </AppButton>
            {existingPlan ? (
              <AppButton onPress={() => setDuplicateAction('copy')} variant="ghost">
                再复制一份
              </AppButton>
            ) : null}
            <AppButton
              disabled={preview.availability !== 'ready'}
              loading={copyAction === 'copy_edit'}
              onPress={() => requestCopy('copy_edit')}
              variant="secondary"
            >
              {existingPlan ? '打开我的副本编辑' : '复制并编辑'}
            </AppButton>
          </View>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setDuplicateAction(null)}
        position="center"
        subtitle="新副本会单独出现在“我的计划”中，并立即成为当前计划。"
        title="确认再复制一份？"
        visible={Boolean(duplicateAction)}
      >
        <View style={styles.actions}>
          <AppButton onPress={() => duplicateAction ? void runCopy(duplicateAction, true) : undefined}>
            确认复制
          </AppButton>
          <AppButton onPress={() => setDuplicateAction(null)} variant="ghost">取消</AppButton>
        </View>
      </AppModalSheet>
      <AppModalSheet
        onClose={() => setActionError(null)}
        position="center"
        subtitle={actionError ?? undefined}
        title="计划操作失败"
        visible={Boolean(actionError)}
      >
        <AppButton onPress={() => setActionError(null)}>知道了</AppButton>
      </AppModalSheet>
      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.sm } });
