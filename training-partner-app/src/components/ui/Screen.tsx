import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

type ScreenProps = {
  children: ReactNode;
  contentStyle?: ViewStyle | ViewStyle[];
  headerRight?: ReactNode;
  scroll?: boolean;
  subtitle?: string;
  title?: string;
};

export function Screen({ children, contentStyle, headerRight, scroll = true, subtitle, title }: ScreenProps) {
  const content = (
    <View style={[styles.content, contentStyle]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="headline">{title}</AppText>
            {subtitle ? (
              <AppText tone="muted" variant="bodySmall">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
});
