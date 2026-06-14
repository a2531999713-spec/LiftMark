import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ActionCard, AppButton, AppCard, AppText, Screen, SectionHeader, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { colors, radius, shadows, spacing } from '@/theme';

const recommendedPlans = [
  { name: '三分化', meta: '胸背腿 · 适合稳定进阶' },
  { name: '五分化', meta: '高频训练 · 全面刺激' },
  { name: '倒金字塔', meta: '力量优先 · 高强度组' },
  { name: '四练增力增肌', meta: '系统方案 · 力量与肌肥大' },
  { name: 'PPL', meta: '推拉腿 · 周期清晰' },
];

function showComingSoon(feature: string) {
  Alert.alert('开发中', `该功能正在开发中，后续版本开放。\n\n${feature}`);
}

export default function ExploreRoute() {
  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="settings-outline" size={20} />
        </Pressable>
      }
      title="探索"
    >
      <Pressable accessibilityRole="search" onPress={() => showComingSoon('搜索')} style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search-outline" size={18} />
        <AppText tone="muted" variant="bodySmall">
          搜索计划、动作、课程
        </AppText>
      </Pressable>

      <VisualHeroCard
        eyebrow="科学计划 · 精准训练"
        icon="barbell-outline"
        imageSource={liftmarkImages.exploreHero}
        subtitle="系统方案、个性化计划、文件导入，帮你高效训练、持续进步。"
        title="选择或创建你的训练计划"
      >
        <AppButton icon="add-outline" onPress={() => router.push('/plan/create')} size="sm">
          去创建计划
        </AppButton>
      </VisualHeroCard>

      <View style={styles.quickGrid}>
        <ActionCard icon="calendar-outline" label="训练计划" onPress={() => router.push('/(tabs)/plan')} />
        <ActionCard icon="barbell-outline" label="动作库" onPress={() => showComingSoon('动作库')} />
        <ActionCard icon="add-circle-outline" label="创建计划" onPress={() => router.push('/plan/create')} />
        <ActionCard icon="download-outline" label="导入计划" onPress={() => showComingSoon('导入计划')} />
      </View>

      <AppCard style={styles.partnerCard} tone="brand">
        <View style={styles.partnerText}>
          <AppText variant="subtitle">找搭子，一起更强</AppText>
          <AppText tone="muted" variant="bodySmall">
            本地小组支持多人同练，同动作不同重量，轮流记录。
          </AppText>
        </View>
        <AppButton onPress={() => router.push('/(tabs)/members')} size="sm">
          去找搭子
        </AppButton>
      </AppCard>

      <SectionHeader
        actionLabel="查看全部"
        onActionPress={() => showComingSoon('计划库')}
        subtitle="先从成熟模板开始，再逐步做自己的训练系统。"
        title="推荐计划"
      />

      <View style={styles.planList}>
        {recommendedPlans.map((plan) => (
          <Pressable
            accessibilityRole="button"
            key={plan.name}
            onPress={() => (plan.name === '四练增力增肌' ? router.push('/(tabs)/plan') : showComingSoon(plan.name))}
            style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
          >
            <View style={styles.planThumb}>
              <Ionicons color={colors.surface} name="barbell-outline" size={20} />
            </View>
            <View style={styles.planBody}>
              <AppText variant="bodySmall" weight="900">
                {plan.name}
              </AppText>
              <AppText tone="muted" variant="caption">
                {plan.meta}
              </AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    minHeight: 168,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroTitle: {
    color: colors.surface,
    maxWidth: 230,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  partnerCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  partnerText: {
    flex: 1,
    gap: spacing.xs,
  },
  planList: {
    gap: spacing.sm,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  planThumb: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  planBody: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.82,
  },
});
