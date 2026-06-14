import Constants from 'expo-constants';
import { Image, StyleSheet, View } from 'react-native';

import { liftmarkBrandAssets } from '@/assets/brand';
import { AppCard, AppText, Screen, SectionHeader, SettingsRow, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export default function AboutRoute() {
  return (
    <Screen title="关于练刻" subtitle="练刻 LiftMark 的品牌、版本和本地数据模式。">
      <AppCard style={styles.brandCard}>
        <Image resizeMode="contain" source={liftmarkBrandAssets.logoPrimary} style={styles.logo} />
        <AppText style={styles.centerText} tone="muted" variant="bodySmall">
          记录每次训练，刻下持续进步。
        </AppText>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="品牌信息" />
        <SettingsRow label="中文名" value="练刻" />
        <SettingsRow label="英文名" value="LiftMark" />
        <SettingsRow label="完整品牌" value="练刻 LiftMark" />
        <SettingsRow label="版本号" value={Constants.expoConfig?.version ?? '0.1.0'} />
        <SettingsRow label="Android package" value="com.liftmark.app" />
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="数据模式" />
        <View style={styles.tagRow}>
          <Tag label="本地优先" tone="success" />
          <Tag label="SQLite" tone="accent" />
          <Tag label="Android APK 预览" tone="brand" />
        </View>
        <AppText tone="muted" variant="bodySmall">
          第一阶段训练计划、成员资料、训练记录和 seed 数据都保存在本机 SQLite 中，不依赖 Web 预览或 Expo Go。
        </AppText>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  logo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 152,
    width: '100%',
  },
  centerText: {
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
