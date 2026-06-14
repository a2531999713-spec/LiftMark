import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type TagTone = 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral' | 'dark';

type TagProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: TagTone;
};

export function Tag({ label, style, tone = 'neutral' }: TagProps) {
  return (
    <View style={[styles.tag, styles[tone], style]}>
      <AppText style={[styles.text, tone === 'dark' && styles.darkText]} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

export function PriorityTag({ priority }: { priority: string }) {
  const tone = priority === 'A' ? 'brand' : priority === 'B' ? 'warning' : priority === 'C' ? 'success' : 'neutral';
  return <Tag label={priority} tone={tone} />;
}

const styles = StyleSheet.create({
  tag: {
    alignItems: 'center',
    borderRadius: radius.xs,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: {
    fontWeight: '900',
  },
  brand: {
    backgroundColor: colors.primarySoft,
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
  },
  dark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  darkText: {
    color: colors.surface,
  },
});
