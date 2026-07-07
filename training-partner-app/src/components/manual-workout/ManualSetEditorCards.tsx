import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { AppButton, AppCard, AppText, Avatar, SectionHeader, Tag } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { ManualExerciseDraft, ManualSetDraft, ManualSetStatus } from '@/store/manualWorkoutDraftStore';
import { colors, radius, spacing, typography } from '@/theme';

import { calculateSetVolume, formatKilograms } from './manualWorkoutUtils';

const statusOptions: { label: string; value: ManualSetStatus; tone: 'success' | 'warning' | 'muted' }[] = [
  { label: '完成', value: 'completed', tone: 'success' },
  { label: '跳过', value: 'skipped', tone: 'warning' },
  { label: '未完成', value: 'pending', tone: 'muted' },
];

export function ManualSetExerciseHero({
  exercise,
  draft,
  onReplace,
}: {
  draft: ManualExerciseDraft;
  exercise?: Exercise;
  onReplace: () => void;
}) {
  return (
    <View style={styles.hero}>
      <Image contentFit="cover" source={liftmarkImages.trainingStudioHero} style={styles.heroImage} />
      <View style={styles.heroScrim} />
      <View style={styles.heroContent}>
        <AppText tone="inverse" variant="title" weight="900">
          {exercise?.name ?? '训练动作'}
        </AppText>
        <View style={styles.heroMetaRow}>
          <Tag label={`${draft.priority} 主项`} tone="dark" />
          <AppText tone="inverse" variant="bodySmall">
            {draft.plannedSets} 计划组 · 休息 {draft.plannedRestSeconds ?? 90} 秒
          </AppText>
        </View>
        <AppButton icon="swap-horizontal-outline" onPress={onReplace} size="sm" variant="dark">
          替换动作
        </AppButton>
      </View>
    </View>
  );
}

export function ManualMemberTabs({
  members,
  onSelect,
  selectedMemberId,
}: {
  members: GroupMember[];
  onSelect: (memberId: string | 'exercise_info') => void;
  selectedMemberId: string | 'exercise_info';
}) {
  return (
    <AppCard padded={false} style={styles.memberTabs}>
      {members.map((member) => {
        const active = selectedMemberId === member.id;
        return (
          <Pressable
            accessibilityRole="button"
            key={member.id}
            onPress={() => onSelect(member.id)}
            style={({ pressed }) => [styles.memberTab, active && styles.memberTabActive, pressed && styles.pressed]}
          >
            <Avatar avatarUrl={member.avatarUrl} name={member.displayName} size={26} />
            <AppText tone={active ? 'brand' : 'muted'} variant="bodySmall" weight="900">
              {member.displayName}
            </AppText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect('exercise_info')}
        style={({ pressed }) => [
          styles.memberTab,
          selectedMemberId === 'exercise_info' && styles.memberTabActive,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons color={selectedMemberId === 'exercise_info' ? colors.brand : colors.textMuted} name="document-text-outline" size={20} />
        <AppText tone={selectedMemberId === 'exercise_info' ? 'brand' : 'muted'} variant="bodySmall" weight="900">
          动作信息
        </AppText>
      </Pressable>
    </AppCard>
  );
}

export function ManualSetEditorCard({
  member,
  onAddSet,
  onCopyPreviousSet,
  onUpdateSet,
  sets,
}: {
  member?: GroupMember;
  onAddSet: () => void;
  onCopyPreviousSet: () => void;
  onUpdateSet: (setId: string, patch: Partial<ManualSetDraft>) => void;
  sets: ManualSetDraft[];
}) {
  const completedCount = sets.filter((set) => set.status === 'completed').length;
  const progress = sets.length > 0 ? completedCount / sets.length : 0;

  return (
    <AppCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <AppText variant="subtitle">组数据（{member?.displayName ?? '成员'}）</AppText>
          <AppText tone="muted" variant="caption">
            计划 {sets.length} 组 · 已完成 {completedCount} 组
          </AppText>
        </View>
        <AppText tone="success" variant="bodySmall" weight="900">
          {Math.round(progress * 100)}%
        </AppText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.setRows}>
        {sets.map((set) => (
          <SetRow key={set.id} set={set} onUpdate={(patch) => onUpdateSet(set.id, patch)} />
        ))}
      </View>
      <View style={styles.inlineActions}>
        <AppButton icon="copy-outline" onPress={onCopyPreviousSet} size="sm" variant="secondary">
          复制上一组
        </AppButton>
        <AppButton icon="add-outline" onPress={onAddSet} size="sm" variant="ghost">
          新增组
        </AppButton>
      </View>
    </AppCard>
  );
}

export function ManualQuickActionsCard({
  onAdvancedPress,
  onGenerateMissing,
  onCopyPrevious,
}: {
  onAdvancedPress: () => void;
  onCopyPrevious: () => void;
  onGenerateMissing: () => void;
}) {
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="快捷操作" />
      <View style={styles.quickGrid}>
        <QuickAction icon="copy-outline" label="复制上一组" onPress={onCopyPrevious} />
        <QuickAction icon="albums-outline" label="从计划生成缺失组" onPress={onGenerateMissing} />
        <QuickAction icon="reader-outline" label="高级记录" meta="RPE / RIR / 备注" onPress={onAdvancedPress} />
      </View>
    </AppCard>
  );
}

export function ManualOtherMembersCard({
  activeMemberId,
  members,
  onSelect,
  draft,
}: {
  activeMemberId: string;
  draft: ManualExerciseDraft;
  members: GroupMember[];
  onSelect: (memberId: string) => void;
}) {
  const otherMembers = members.filter((member) => member.id !== activeMemberId);
  if (otherMembers.length === 0) return null;

  return (
    <View style={styles.otherList}>
      {otherMembers.map((member) => {
        const memberSet = draft.memberSets.find((item) => item.memberId === member.id);
        const sets = memberSet?.sets ?? [];
        const volume = sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
        return (
          <Pressable
            accessibilityRole="button"
            key={member.id}
            onPress={() => onSelect(member.id)}
            style={({ pressed }) => [styles.otherCard, pressed && styles.pressed]}
          >
            <View style={styles.otherHeader}>
              <Avatar avatarUrl={member.avatarUrl} name={member.displayName} size={38} />
              <View style={styles.otherText}>
                <AppText variant="bodySmall" weight="900">
                  {member.displayName}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {sets.length} 组 · {formatKilograms(volume)} · 点击展开编辑
                </AppText>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-down" size={20} />
            </View>
            <View style={styles.setPills}>
              {sets.slice(0, 4).map((set) => (
                <View key={set.id} style={styles.setPill}>
                  <AppText tone="muted" variant="caption">
                    {set.weight || '-'}kg×{set.reps || '-'}
                  </AppText>
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ManualSetEditorBottomBar({
  isSaving,
  onNext,
  onPrevious,
  onSave,
  title,
  totalSets,
  totalVolume,
}: {
  isSaving: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onSave: () => void;
  title: string;
  totalSets: number;
  totalVolume: number;
}) {
  return (
    <AppCard style={styles.bottomBar}>
      <View style={styles.bottomIcon}>
        <Ionicons color={colors.brand} name="barbell-outline" size={22} />
      </View>
      <View style={styles.bottomText}>
        <AppText variant="bodySmall" weight="900">
          {title}合计
        </AppText>
        <AppText tone="muted" variant="caption">
          {totalSets} 组 · {formatKilograms(totalVolume)}
        </AppText>
      </View>
      <View style={styles.bottomActions}>
        <AppButton icon="chevron-back" onPress={onPrevious} size="sm" variant="secondary">
          上一个
        </AppButton>
        <AppButton icon="chevron-forward" onPress={onNext} size="sm" variant="secondary">
          下一个
        </AppButton>
        <AppButton icon="save-outline" loading={isSaving} onPress={onSave} size="sm">
          保存
        </AppButton>
      </View>
    </AppCard>
  );
}

function SetRow({ onUpdate, set }: { onUpdate: (patch: Partial<ManualSetDraft>) => void; set: ManualSetDraft }) {
  return (
    <View style={styles.setRow}>
      <View style={styles.setNumber}>
        <AppText variant="bodySmall" weight="900">
          {set.setIndex}
        </AppText>
      </View>
      <SmallInput
        keyboardType="decimal-pad"
        label="重量 kg"
        onChangeText={(weight) => onUpdate({ weight })}
        value={set.weight}
      />
      <SmallInput
        keyboardType="number-pad"
        label="次数"
        onChangeText={(reps) => onUpdate({ reps })}
        value={set.reps}
      />
      <View style={styles.statusCell}>
        {statusOptions.map((option) => {
          const active = set.status === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onUpdate({ status: option.value })}
              style={[styles.statusChip, active && styles.statusChipActive]}
            >
              <AppText tone={active ? option.tone : 'muted'} variant="caption" weight="900">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SmallInput({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  keyboardType: 'decimal-pad' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.smallInputBlock}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder="-"
        placeholderTextColor={colors.textSubtle}
        style={styles.smallInput}
        value={value}
      />
    </View>
  );
}

function QuickAction({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={styles.quickIcon}>
        <Ionicons color={colors.accent} name={icon} size={19} />
      </View>
      <View style={styles.quickText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {label}
        </AppText>
        {meta ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {meta}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  bottomBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  bottomIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bottomText: {
    flex: 1,
    gap: 2,
    minWidth: 94,
  },
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    minHeight: 168,
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.xl,
    width: '70%',
  },
  heroImage: {
    bottom: 0,
    opacity: 0.46,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '58%',
  },
  heroMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroScrim: {
    backgroundColor: colors.dark,
    bottom: 0,
    left: 0,
    opacity: 0.62,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberTab: {
    alignItems: 'center',
    borderColor: colors.transparent,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  memberTabActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  memberTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  otherCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  otherHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  otherList: {
    gap: spacing.md,
  },
  otherText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  progressFill: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 7,
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 7,
    overflow: 'hidden',
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    minWidth: '31%',
    padding: spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  quickText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  setNumber: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  setPill: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  setPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  setRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  setRows: {
    gap: spacing.md,
  },
  smallInput: {
    color: colors.text,
    fontSize: typography.sizes.subtitle,
    fontWeight: '800',
    minHeight: 26,
    padding: 0,
    textAlign: 'center',
  },
  smallInputBlock: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 54,
    minWidth: 86,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusCell: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    minWidth: 124,
  },
  statusChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  statusChipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
  },
});
