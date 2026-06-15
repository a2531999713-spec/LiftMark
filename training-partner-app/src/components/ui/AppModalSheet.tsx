import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppCard } from './AppCard';
import { AppText } from './AppText';

type AppModalSheetProps = {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  position?: 'bottom' | 'center';
  subtitle?: string;
  title: string;
  visible: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AppModalSheet({
  children,
  contentStyle,
  footer,
  onClose,
  position = 'bottom',
  subtitle,
  title,
  visible,
}: AppModalSheetProps) {
  return (
    <Modal animationType={position === 'bottom' ? 'slide' : 'fade'} transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.backdrop, position === 'center' && styles.centerBackdrop]}>
        <Pressable accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
        <AppCard style={[styles.panel, position === 'center' && styles.centerPanel]}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <AppText variant="title">{title}</AppText>
              {subtitle ? (
                <AppText tone="muted" variant="bodySmall">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close-outline" size={21} />
            </Pressable>
          </View>
          <View style={[styles.content, contentStyle]}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </AppCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  centerBackdrop: {
    justifyContent: 'center',
  },
  centerPanel: {
    maxWidth: 480,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {
    gap: spacing.md,
  },
  footer: {
    gap: spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  panel: {
    gap: spacing.lg,
    width: '100%',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
});
