import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Screen, SettingsRow, Tag } from '@/components/ui';
import { spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfileSyncRoute() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  return (
    <Screen safeTop={false}>
      <AppCard style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <AppText variant="title" weight="900">
              训练数据
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              训练计划、成员和训练记录会保留在当前设备。
            </AppText>
          </View>
          <Tag label="已保存" tone="success" />
        </View>
        <SettingsRow label="训练记录" value="当前设备" />
        <SettingsRow label="成员档案" value="当前设备" />
        <SettingsRow label="计划文件" value="可手动导出" />
      </AppCard>

      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          多设备数据能力
        </AppText>
        <AppText tone="muted" variant="caption">
          该功能正在开发中，后续版本开放。
        </AppText>
      </AppCard>

      <AppButton
        onPress={() =>
          setNotice({
            title: '训练数据',
            message: '当前版本训练记录会保留在当前设备；计划文件可在计划导出页面手动生成。',
          })
        }
        variant="secondary"
      >
        查看说明
      </AppButton>

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

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
});
