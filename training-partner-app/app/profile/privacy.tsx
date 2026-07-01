import { StyleSheet } from 'react-native';

import { AppCard, AppText, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export default function ProfilePrivacyRoute() {
  return (
    <Screen safeTop={false}>
      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          你的数据由你掌控
        </AppText>
        <AppText tone="muted" variant="caption">
          训练数据默认仅自己可见，小组内只显示汇总信息。
        </AppText>
      </AppCard>

      <AppCard style={styles.card}>
        <AppText variant="bodySmall" weight="900">
          数据优先保留
        </AppText>
        <AppText tone="muted" variant="caption">
          当前版本训练记录会保留在当前设备；账号退出不会删除训练记录，会员到期也不会删除计划、小组或历史。
        </AppText>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
});
