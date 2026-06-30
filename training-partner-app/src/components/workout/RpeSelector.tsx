import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type RpeSelectorProps = {
  onChange: (value: number | undefined) => void;
  value?: number;
};

const rpeValues = Array.from({ length: 10 }, (_, index) => index + 1);

export function RpeSelector({ onChange, value }: RpeSelectorProps) {
  const [isExpanded, setExpanded] = useState(value !== undefined);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
      >
        <View>
          <AppText tone="muted" variant="caption">
            RPE
          </AppText>
          <AppText variant="bodySmall" weight="900">
            {value ? `${value} / 10` : '未记录'}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>
      {isExpanded ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {rpeValues.map((item) => {
                const active = item === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => onChange(active ? undefined : item)}
                    style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && styles.pressed]}
                  >
                    <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
                      {item}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        {value ? (
          <Pressable accessibilityRole="button" onPress={() => onChange(undefined)} style={styles.clearButton}>
            <AppText tone="muted" variant="caption" weight="800">
              清除
            </AppText>
          </Pressable>
        ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 40,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
  wrap: {
    gap: spacing.xs,
  },
});
