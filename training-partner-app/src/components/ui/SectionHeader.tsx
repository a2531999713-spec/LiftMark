import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppButton } from './AppButton';
import { AppText } from './AppText';

type SectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  subtitle?: string;
  title: string;
};

export function SectionHeader({ actionLabel, onActionPress, subtitle, title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <AppText variant="subtitle">{title}</AppText>
        {subtitle ? (
          <AppText tone="muted" variant="bodySmall">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel ? (
        <AppButton onPress={onActionPress} size="sm" variant="ghost">
          {actionLabel}
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
});
