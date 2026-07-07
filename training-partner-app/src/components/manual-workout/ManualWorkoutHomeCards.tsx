import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { formatExerciseEquipment } from '@/components/exercises/ExercisePickerSheet';
import { AppButton, AppCard, AppText, Avatar, SectionHeader, Tag } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutTrainingMode } from '@/domain/workout/workout.types';
import type { ManualExerciseDraft } from '@/store/manualWorkoutDraftStore';
import { colors, radius, spacing, typography } from '@/theme';

import { formatKilograms, type ManualWorkoutSummary } from './manualWorkoutUtils';

type ExerciseMap = Record<string, Exercise | undefined>;

export function ManualWorkoutHero({
  date,
  participantCount,
  summary,
  title,
}: {
  date: string;
  participantCount: number;
  summary: ManualWorkoutSummary;
  title: string;
}) {
  return (
    <View style={styles.hero}>
      <Image contentFit="cover" source={liftmarkImages.trainingHero} style={styles.heroImage} />
      <View style={styles.heroScrim} />
      <View style={styles.heroContent}>
        <AppText tone="inverse" variant="title" weight="900">
          {title || '补录训练'} · {date.replaceAll('-', '/')}
        </AppText>
        <AppText tone="inverse" variant="bodySmall">
          {participantCount} 人参与 · {summary.exerciseCount} 个动作 · {summary.plannedSetCount} 组 · {formatKilograms(summary.totalVolume)}
        </AppText>
        <View style={styles.heroStatus}>
          <Ionicons color={colors.brand} name="time-outline" size={15} />
          <AppText tone="brand" variant="caption" weight="900">
            待保存
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function ManualWorkoutModeSwitch({
  onChange,
  value,
}: {
  onChange: (value: WorkoutTrainingMode) => void;
  value: WorkoutTrainingMode;
}) {
  const options: { icon: keyof typeof Ionicons.glyphMap; label: string; value: WorkoutTrainingMode }[] = [
    { icon: 'person', label: '个人补录', value: 'solo_local' },
    { icon: 'people', label: '小组补录', value: 'group_local' },
  ];

  return (
    <AppCard padded={false} style={styles.segmentCard}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && styles.pressed]}
          >
            <Ionicons color={active ? colors.brand : colors.textMuted} name={option.icon} size={18} />
            <AppText tone={active ? 'brand' : 'muted'} variant="bodySmall" weight="900">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </AppCard>
  );
}

export function ManualWorkoutInfoCard({
  date,
  onDateChange,
  onPlanPress,
  onTitleChange,
  planLabel,
  title,
}: {
  date: string;
  onDateChange: (value: string) => void;
  onPlanPress: () => void;
  onTitleChange: (value: string) => void;
  planLabel: string;
  title: string;
}) {
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="训练信息" />
      <View style={styles.infoGrid}>
        <InfoField icon="calendar-outline" label="训练日期" onChangeText={onDateChange} value={date} />
        <InfoField icon="document-text-outline" label="训练标题" onChangeText={onTitleChange} value={title} />
        <ActionField icon="link-outline" label="关联计划" onPress={onPlanPress} value={planLabel} />
      </View>
    </AppCard>
  );
}

export function ManualWorkoutParticipantsCard({
  members,
  onTempMemberPress,
  onToggle,
  selectedMemberIds,
}: {
  members: GroupMember[];
  onTempMemberPress: () => void;
  onToggle: (memberId: string) => void;
  selectedMemberIds: string[];
}) {
  const selected = new Set(selectedMemberIds);

  return (
    <AppCard style={styles.card}>
      <SectionHeader actionLabel="+ 临时成员" onActionPress={onTempMemberPress} title="参与成员" />
      <View style={styles.memberGrid}>
        {members.map((member) => {
          const active = selected.has(member.id);
          return (
            <Pressable
              accessibilityRole="button"
              key={member.id}
              onPress={() => onToggle(member.id)}
              style={({ pressed }) => [styles.memberCard, active && styles.memberCardActive, pressed && styles.pressed]}
            >
              <Avatar
                avatarLocalUri={member.avatarUrl}
                avatarUrl={member.avatarUrl}
                name={member.displayName}
                size={38}
              />
              <View style={styles.memberText}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {member.displayName}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {active ? '已选' : '可选'}
                </AppText>
              </View>
              <Ionicons
                color={active ? colors.brand : colors.textSubtle}
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
              />
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

export function ManualWorkoutExerciseList({
  exerciseMap,
  exercises,
  onAddExercise,
  onOpenExercise,
  onRemoveExercise,
  participantCount,
}: {
  exerciseMap: ExerciseMap;
  exercises: ManualExerciseDraft[];
  onAddExercise: () => void;
  onOpenExercise: (draftId: string) => void;
  onRemoveExercise: (draftId: string) => void;
  participantCount: number;
}) {
  return (
    <AppCard style={styles.card}>
      <SectionHeader actionLabel="+ 动作" onActionPress={onAddExercise} title="动作列表" />
      <View style={styles.exerciseList}>
        {exercises.map((draft, index) => {
          const exercise = exerciseMap[draft.exerciseId];
          const priorityStyle = draft.priority === 'A'
            ? styles.priorityA
            : draft.priority === 'B'
              ? styles.priorityB
              : styles.priorityC;
          return (
            <Pressable
              accessibilityRole="button"
              key={draft.id}
              onPress={() => onOpenExercise(draft.id)}
              style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
            >
              <View style={[styles.priorityBadge, priorityStyle]}>
                <AppText tone="brand" variant="subtitle" weight="900">
                  {draft.priority}
                </AppText>
              </View>
              <View style={styles.exerciseMain}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {exercise?.name ?? `动作 ${index + 1}`}
                </AppText>
                <AppText numberOfLines={1} tone="muted" variant="caption">
                  {exercise ? `${exercise.targetMuscle} · ${formatExerciseEquipment(exercise.equipment)}` : '动作库'}
                </AppText>
              </View>
              <View style={styles.exerciseMeta}>
                <AppText variant="caption" weight="900">
                  {participantCount}人 · {draft.plannedSets}组
                </AppText>
                <AppText tone="muted" variant="caption">
                  进入录入
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  onRemoveExercise(draft.id);
                }}
                style={styles.rowIconButton}
              >
                <Ionicons color={colors.textMuted} name="trash-outline" size={17} />
              </Pressable>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

export function ManualWorkoutSaveCheckCard({
  participantCount,
  summary,
  trainingMode,
}: {
  participantCount: number;
  summary: ManualWorkoutSummary;
  trainingMode: WorkoutTrainingMode;
}) {
  const targetLabel = trainingMode === 'solo_local' ? `个人补录（${participantCount} 人）` : `小组补录（${participantCount} 人）`;
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="保存前检查" />
      <View style={styles.checkRows}>
        <CheckRow icon="people-outline" label="训练对象" value={targetLabel} />
        <CheckRow icon="stats-chart-outline" label="训练数据" value={`${summary.exerciseCount} 个动作 · ${summary.plannedSetCount} 组 · ${formatKilograms(summary.totalVolume)}`} />
        <CheckRow icon="folder-outline" label="保存后去向" value="将保存至历史记录" />
      </View>
      <View style={styles.tagRow}>
        <Tag label="不会影响计划" tone="success" />
        <Tag label="数据完整" tone="success" />
        <Tag label="可继续编辑历史" tone="brand" />
      </View>
    </AppCard>
  );
}

export function ManualWorkoutBottomBar({
  dateLabel,
  disabled,
  isSaving,
  onSave,
  participantCount,
  summary,
}: {
  dateLabel: string;
  disabled?: boolean;
  isSaving: boolean;
  onSave: () => void;
  participantCount: number;
  summary: ManualWorkoutSummary;
}) {
  return (
    <AppCard style={styles.bottomBar}>
      <View style={styles.bottomIcon}>
        <Ionicons color={colors.brand} name="pie-chart" size={22} />
      </View>
      <View style={styles.bottomText}>
        <AppText variant="bodySmall" weight="900">
          {summary.exerciseCount} 动作 · {summary.plannedSetCount} 组 · {formatKilograms(summary.totalVolume)}
        </AppText>
        <AppText tone="muted" variant="caption">
          {participantCount} 人参与 · {dateLabel}
        </AppText>
      </View>
      <AppButton disabled={disabled} icon="save-outline" loading={isSaving} onPress={onSave} style={styles.saveButton}>
        保存补录
      </AppButton>
    </AppCard>
  );
}

function InfoField({
  icon,
  label,
  onChangeText,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.infoField}>
      <View style={styles.inlineLabel}>
        <Ionicons color={colors.textMuted} name={icon} size={16} />
        <AppText tone="muted" variant="caption">
          {label}
        </AppText>
      </View>
      <TextInput
        onChangeText={onChangeText}
        placeholderTextColor={colors.textSubtle}
        style={styles.infoInput}
        value={value}
      />
    </View>
  );
}

function ActionField({
  icon,
  label,
  onPress,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.infoField, pressed && styles.pressed]}>
      <View style={styles.inlineLabel}>
        <Ionicons color={colors.textMuted} name={icon} size={16} />
        <AppText tone="muted" variant="caption">
          {label}
        </AppText>
      </View>
      <AppText variant="bodySmall" weight="900">
        {value}
      </AppText>
    </Pressable>
  );
}

function CheckRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons color={colors.textMuted} name={icon} size={18} />
      <AppText style={styles.checkLabel} variant="bodySmall">
        {label}
      </AppText>
      <AppText numberOfLines={1} style={styles.checkValue} tone="muted" variant="bodySmall">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 0,
  },
  card: {
    gap: spacing.md,
  },
  checkLabel: {
    minWidth: 78,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 34,
  },
  checkRows: {
    gap: spacing.xs,
  },
  checkValue: {
    flex: 1,
    textAlign: 'right',
  },
  exerciseList: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  exerciseMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
  },
  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    minHeight: 142,
    overflow: 'hidden',
  },
  heroContent: {
    gap: spacing.sm,
    padding: spacing.xl,
    width: '78%',
  },
  heroImage: {
    bottom: 0,
    opacity: 0.42,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '58%',
  },
  heroScrim: {
    backgroundColor: colors.dark,
    bottom: 0,
    left: 0,
    opacity: 0.64,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroStatus: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  infoField: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 64,
    minWidth: '31%',
    padding: spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoInput: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 24,
    padding: 0,
  },
  inlineLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    minWidth: '47%',
    padding: spacing.sm,
  },
  memberCardActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  memberText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  priorityA: {
    backgroundColor: colors.brandSoft,
  },
  priorityB: {
    backgroundColor: colors.accentSoft,
  },
  priorityBadge: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  priorityC: {
    backgroundColor: colors.successSoft,
  },
  rowIconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  saveButton: {
    minWidth: 118,
  },
  segmentCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xs,
  },
  segmentItem: {
    alignItems: 'center',
    borderColor: colors.transparent,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
  },
  segmentItemActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
