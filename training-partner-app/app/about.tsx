import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { AppText, Screen, SettingsRow } from '@/components/ui';
import { ProfileSection } from '@/components/profile';
import { BUILD_INFO, HAS_BUILD_INFO } from '@/config/buildInfo';
import { colors, radius, spacing } from '@/theme';

const APP_CONFIG = {
  name: '练刻 LiftMark',
  androidPackage: 'com.liftmark.app',
  description: [
    '练刻是一款力量训练计划执行工具。它帮助你运行结构化训练计划，为每位成员保持独立的训练身份，记录训练历史，支持多人协作训练。',
    '核心理念：让每次训练都有据可依，让进步清晰可见。'
  ]
} as const;

function formatBuildTime(iso: string): string {
  if (!iso) return '未构建';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')} ${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function AboutRoute() {
  const version = Constants.expoConfig?.version ?? BUILD_INFO.appVersion;

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <AppText variant="headline" weight="900" style={styles.logoText}>
            练刻
          </AppText>
        </View>
        <AppText variant="subtitle" weight="700" style={styles.heroName}>
          LiftMark
        </AppText>
        <AppText variant="bodySmall" tone="muted">
          记录每次训练，刻下持续进步
        </AppText>
      </View>

      <ProfileSection title="">
        <View style={styles.aboutBlock}>
          <SettingsRow label="App 名称" value={APP_CONFIG.name} />
          <SettingsRow label="版本" value={version} />
          <SettingsRow label="Android package" value={APP_CONFIG.androidPackage} />

          {APP_CONFIG.description.map((text, index) => (
            <AppText
              key={index}
              variant="body"
              tone="muted"
              style={styles.aboutText}
            >
              {text}
            </AppText>
          ))}
        </View>
      </ProfileSection>

      <ProfileSection title="构建信息">
        <View style={styles.aboutBlock}>
          <SettingsRow label="Commit" value={BUILD_INFO.commit || '未知'} />
          <SettingsRow label="分支" value={BUILD_INFO.branch || '未知'} />
          <SettingsRow label="构建时间" value={formatBuildTime(BUILD_INFO.builtAt)} />
          <SettingsRow label="API 地址" value={BUILD_INFO.apiBaseUrl} />
          <AppText variant="caption" tone="muted" style={styles.buildHint}>
            {HAS_BUILD_INFO
              ? '当前为已构建版本，以上信息来自本次打包。'
              : '当前为开发态，构建后会显示真实 commit / 分支 / 时间。'}
          </AppText>
        </View>
      </ProfileSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.surface,
  },
  heroName: {
    color: colors.textStrong,
    letterSpacing: 1,
  },
  aboutBlock: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  aboutText: {
    lineHeight: 22,
  },
  buildHint: {
    lineHeight: 18,
    paddingTop: spacing.xs,
  },
});
