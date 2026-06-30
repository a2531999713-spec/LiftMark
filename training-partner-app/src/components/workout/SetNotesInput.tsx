import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type SetNotesInputProps = {
  onChange: (value: string | undefined) => void;
  value?: string;
};

export function SetNotesInput({ onChange, value }: SetNotesInputProps) {
  return (
    <View style={styles.wrap}>
      <AppText tone="muted" variant="caption">
        本组备注
      </AppText>
      <TextInput
        multiline
        onChangeText={(text) => onChange(text.trim().length > 0 ? text : undefined)}
        placeholder="状态、动作感觉或临时调整"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value ?? ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textStrong,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  wrap: {
    gap: spacing.xs,
  },
});
