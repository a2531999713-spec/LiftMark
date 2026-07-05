import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type AccountPanelHeaderProps = {
  canSave?: boolean;
  isSaving?: boolean;
  onBack: () => void;
  onSave?: () => void;
  subtitle?: string;
  title: string;
};

export function AccountPanelHeader({
  canSave = false,
  isSaving = false,
  onBack,
  onSave,
  subtitle,
  title,
}: AccountPanelHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Ionicons color={colors.textStrong} name="chevron-back" size={21} />
      </Pressable>
      <View style={styles.titleBlock}>
        <AppText numberOfLines={1} variant="subtitle" weight="900">
          {title}
        </AppText>
        {subtitle ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {canSave && onSave ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onSave}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}
        >
          <AppText tone="inverse" variant="caption" weight="900">
            {isSaving ? '保存中' : '保存'}
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.savePlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  disabled: {
    opacity: 0.65,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
  },
  pressed: {
    opacity: 0.82,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    minWidth: 54,
    paddingHorizontal: spacing.md,
  },
  savePlaceholder: {
    width: 54,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
});
