import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, View } from 'react-native';

import { AppButton, AppText } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

type AuthRequiredSheetProps = {
  message?: string;
  onClose: () => void;
  onLogin: () => void;
  title?: string;
  visible: boolean;
};

export function AuthRequiredSheet({
  message,
  onLogin,
  title = '登录后开始记录训练',
  visible,
}: AuthRequiredSheetProps) {
  return (
    <Modal animationType="fade" onRequestClose={onLogin} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons color={colors.surface} name="flash" size={22} />
            </View>
            <AppText variant="subtitle" weight="900">
              练刻 LiftMark
            </AppText>
          </View>

          <View style={styles.copyBlock}>
            <AppText style={styles.title} weight="900">
              {title}
            </AppText>
            <AppText style={styles.subtitle} tone="muted" variant="bodySmall">
              {message ?? '训练记录会保存到账号中，换手机或重装后也能恢复数据。'}
            </AppText>
          </View>

          <View style={styles.pillRow}>
            <LoginValuePill icon="bar-chart-outline" label="训练记录" />
            <LoginValuePill icon="swap-horizontal-outline" label="计划同步" />
            <LoginValuePill icon="cloud-outline" label="换机恢复" />
          </View>

          <AppButton icon="log-in-outline" onPress={onLogin} size="lg" style={styles.loginButton}>
            登录 / 注册
          </AppButton>
        </View>
      </View>
    </Modal>
  );
}

function LoginValuePill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons color={colors.textStrong} name={icon} size={16} />
      <AppText variant="caption" weight="900">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loginButton: {
    borderRadius: radius.xl,
    minHeight: 58,
    width: '100%',
  },
  panel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.xl,
    maxWidth: 460,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    width: '100%',
    ...shadows.raised,
  },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  subtitle: {
    maxWidth: 270,
    textAlign: 'center',
  },
  title: {
    color: colors.textStrong,
    fontSize: 27,
    lineHeight: 34,
    textAlign: 'center',
  },
});
