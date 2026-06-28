import { Alert } from 'react-native';
import { useState } from 'react';

import { AppButton, AppCard, AppModalSheet, AppText, Screen } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';
import { spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfilePrivacyRoute() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const confirmClearData = () => {
    Alert.alert('确定清除所有数据？', '此操作将删除所有训练记录、计划和个人数据，且不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除数据',
        style: 'destructive',
        onPress: () =>
          setNotice({
            title: '清除数据',
            message: '数据清除功能正在完善中，即将开放。',
          }),
      },
    ]);
  };

  return (
    <Screen title="数据管理" subtitle="清除训练数据。">
      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          你的数据由你掌控
        </AppText>
        <AppText tone="muted" variant="caption">
          训练数据默认仅自己可见，小组内只显示汇总信息。
        </AppText>
      </AppCard>

      <ProfileSection icon="trash-outline" title="清除数据">
        <ProfileMenuItem
          danger
          icon="trash-outline"
          label="清除所有数据"
          description="删除训练记录、计划和个人数据"
          onPress={confirmClearData}
        />
      </ProfileSection>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

const styles = {
  card: {
    gap: spacing.md,
  },
};
