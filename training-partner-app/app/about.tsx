import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Screen, SecondaryPageHeader } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';
import { colors, radius, spacing } from '@/theme';

const CONTACT_EMAIL = 'a2531999713@163.com';

export default function AboutRoute() {
  const handleEmail = useCallback(() => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('练刻 LiftMark - 意见反馈')}`);
  }, []);

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="关于练刻"
        icon="information-circle-outline"
        meta={`v${Constants.expoConfig?.version ?? '0.1.0'}`}
        subtitle="云端优先、弱网可用的力量训练计划执行器，服务多人轮换和训练记录。"
        title="练刻 LiftMark"
      />
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <AppText variant="headline" weight="900" style={styles.logoText}>练刻</AppText>
        </View>
        <AppText variant="subtitle" weight="700" style={styles.heroName}>LiftMark</AppText>
        <AppText variant="bodySmall" tone="muted">记录每次训练，刻下持续进步</AppText>
      </View>

      <ProfileSection title="关于">
        <View style={styles.aboutBlock}>
          <AppText variant="body" tone="muted" style={styles.aboutText}>
            练刻是一款力量训练计划执行工具。它帮助你运行结构化训练计划，为每位成员保持独立的训练身份，记录训练历史，支持多人协作训练。
          </AppText>
          <AppText variant="body" tone="muted" style={styles.aboutText}>
            核心理念：让每次训练都有据可依，让进步清晰可见。
          </AppText>
        </View>
      </ProfileSection>

      <ProfileSection title="意见反馈">
        <ProfileMenuItem
          description="发送邮件反馈问题或建议"
          icon="mail-outline"
          label="意见反馈"
          onPress={handleEmail}
          trailing={CONTACT_EMAIL}
        />
      </ProfileSection>

      <ProfileSection title="服务条款">
        <ProfileMenuItem
          description="查看用户服务协议"
          icon="document-text-outline"
          label="用户协议"
          onPress={() => router.push('/terms' as never)}
        />
        <ProfileMenuItem
          description="查看隐私保护政策"
          icon="document-lock-outline"
          label="隐私政策"
          onPress={() => router.push('/privacy' as never)}
        />
      </ProfileSection>

      <View style={styles.versionBlock}>
        <AppText variant="caption" tone="subtle">
          版本 {Constants.expoConfig?.version ?? '0.1.0'}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aboutBlock: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  aboutText: {
    lineHeight: 22,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  heroName: {
    color: colors.textStrong,
    letterSpacing: 1,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  logoText: {
    color: colors.surface,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  versionBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
});
