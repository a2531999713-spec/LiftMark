import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { View } from 'react-native';

import { Screen } from '@/components/ui';

export default function HistoryEditRoute() {
  const { memberId, scope, sessionId } = useLocalSearchParams<{
    memberId?: string;
    scope?: 'personal' | 'group';
    sessionId: string;
  }>();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    router.replace({
      pathname: '/history/[sessionId]',
      params: {
        ...(memberId ? { memberId } : {}),
        ...(scope ? { scope } : {}),
        edit: '1',
        sessionId,
      },
    } as never);
  }, [memberId, scope, sessionId]);

  return (
    <Screen title="编辑记录" subtitle="正在打开编辑页">
      <View />
    </Screen>
  );
}
