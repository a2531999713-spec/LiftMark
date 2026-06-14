import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

type VisualHeroCardProps = {
  children?: ReactNode;
  eyebrow?: string;
  icon?: IconName;
  imageSource?: ImageSourcePropType;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

export function VisualHeroCard({
  children,
  eyebrow,
  icon = 'barbell-outline',
  imageSource,
  minHeight = 180,
  style,
  subtitle,
  title,
}: VisualHeroCardProps) {
  return (
    <View style={[styles.card, { minHeight }, style]}>
      {imageSource ? (
        <ImageBackground imageStyle={styles.image} resizeMode="cover" source={imageSource} style={styles.imageBackground}>
          <View style={styles.imageScrim} />
          <View style={styles.imageTextScrim} />
        </ImageBackground>
      ) : (
        <>
          <View style={styles.backgroundCircleLarge} />
          <View style={styles.backgroundCircleSmall} />
          <View style={styles.plateStack}>
            <View style={styles.plate} />
            <View style={[styles.plate, styles.plateSmall]} />
            <View style={styles.bar} />
          </View>
        </>
      )}
      <View style={styles.content}>
        {eyebrow ? (
          <View style={styles.eyebrow}>
            <AppText tone="inverse" variant="caption" weight="900">
              {eyebrow}
            </AppText>
          </View>
        ) : null}
        <View style={styles.titleGroup}>
          <AppText style={styles.title} variant="title">
            {title}
          </AppText>
          {subtitle ? (
            <AppText tone="inverse" variant="bodySmall">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </View>
      <View style={styles.iconBubble}>
        <Ionicons color={colors.surface} name={icon} size={28} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  imageBackground: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  image: {
    opacity: 0.96,
  },
  imageScrim: {
    backgroundColor: 'rgba(1,12,22,0.36)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  imageTextScrim: {
    backgroundColor: 'rgba(1,12,22,0.54)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '72%',
  },
  backgroundCircleLarge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 140,
    height: 280,
    position: 'absolute',
    right: -80,
    top: -80,
    width: 280,
  },
  backgroundCircleSmall: {
    backgroundColor: 'rgba(255,90,95,0.24)',
    borderRadius: 80,
    bottom: -24,
    height: 160,
    position: 'absolute',
    right: 40,
    width: 160,
  },
  plateStack: {
    bottom: 28,
    opacity: 0.55,
    position: 'absolute',
    right: 24,
  },
  plate: {
    borderColor: 'rgba(255,255,255,0.36)',
    borderRadius: 52,
    borderWidth: 10,
    height: 104,
    width: 104,
  },
  plateSmall: {
    borderWidth: 7,
    height: 76,
    position: 'absolute',
    right: 58,
    top: 14,
    width: 76,
  },
  bar: {
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderRadius: radius.pill,
    height: 8,
    position: 'absolute',
    right: 100,
    top: 48,
    width: 136,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    paddingRight: 116,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  title: {
    color: colors.surface,
  },
  titleGroup: {
    gap: spacing.xs,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,90,95,0.84)',
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
    width: 54,
  },
});
