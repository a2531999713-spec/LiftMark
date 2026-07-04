import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText, Screen, SecondaryPageHeader, SettingsRow, Tag } from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function BackupRoute() {
  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="数据备份"
        icon="server-outline"
        subtitle="当前版本先提供本机备份状态和计划导出入口。"
        tag="本机保存"
        title="备份与导出"
      />

      <AppCard style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons color={colors.primary} name="server-outline" size={28} />
        </View>
        <View style={styles.heroText}>
          <AppText variant="subtitle" weight="900">
            训练数据优先保存在本机
          </AppText>
          <AppText tone="muted" variant="bodySmall">
            完整云端备份仍在开发中。当前可先导出计划文件，并在云同步页查看队列状态。
          </AppText>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SettingsRow label="备份状态" right={<Tag label="本机保存" tone="neutral" />} />
        <SettingsRow label="云端备份" value="开发中" />
        <SettingsRow label="最近备份" value="未设置" />
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={() => router.push('/profile/data' as never)}>
          导出当前计划
        </AppButton>
        <AppButton onPress={() => router.push('/sync' as never)} variant="secondary">
          查看同步状态
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
