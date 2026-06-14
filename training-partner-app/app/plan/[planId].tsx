import { useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function PlanDetailRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();

  return (
    <Screen title="计划详情" subtitle="计划深度编辑会在后续版本开放。">
      <EmptyState
        title="计划详情正在开发中"
        description={`该功能正在开发中，后续版本开放。${planId ? `当前计划 ID：${planId}` : ''}`}
      />
    </Screen>
  );
}
