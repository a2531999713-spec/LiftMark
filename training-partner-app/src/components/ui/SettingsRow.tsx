import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

type SettingsRowProps = {
  label: string;
  right?: ReactNode;
  value?: string;
};

export function SettingsRow({ label, right, value }: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <AppText tone="muted" variant="bodySmall">
        {label}
      </AppText>
      {right ?? (
        <AppText style={styles.value} variant="bodySmall" weight="900">
          {value ?? '-'}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 42,
    paddingTop: spacing.sm,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
