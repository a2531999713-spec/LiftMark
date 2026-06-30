import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type {
  TrainingDaysPerWeek,
  TrainingEquipment,
  TrainingExperience,
  TrainingGoal,
  TrainingProfileDraft,
} from '@/domain/onboarding/trainingProfile.types';
import { recommendPlans } from '@/domain/plan/planRecommendation';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';

type NoticeState = { message: string; title: string };

const goalOptions: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: TrainingGoal;
}[] = [
  { description: '增加肌肉体积，改善体型', icon: 'barbell-outline', label: '增肌', value: 'hypertrophy' },
  { description: '提升最大力量和爆发力', icon: 'flash-outline', label: '增力', value: 'strength' },
  { description: '减少体脂，保留肌肉', icon: 'flame-outline', label: '减脂保肌', value: 'fat_loss' },
  { description: '建立训练习惯，打好基础', icon: 'walk-outline', label: '新手入门', value: 'beginner' },
  { description: '减轻疲劳，恢复身体状态', icon: 'leaf-outline', label: '恢复训练', value: 'recovery' },
];

const dayOptions: TrainingDaysPerWeek[] = [2, 3, 4, 5, 'flexible'];

const experienceOptions: {
  description: string;
  label: string;
  value: TrainingExperience;
}[] = [
  { description: '0-3 个月训练经验', label: '刚开始训练', value: 'just_started' },
  { description: '有一定训练基础', label: '3 个月以内', value: 'under_3_months' },
  { description: '已有系统训练经验', label: '3-12 个月', value: 'three_to_twelve_months' },
  { description: '长期稳定训练', label: '1 年以上', value: 'over_one_year' },
];

const equipmentOptions: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: TrainingEquipment;
}[] = [
  { description: '杠铃、器械、拉力器齐全', icon: 'business-outline', label: '健身房完整器械', value: 'full_gym' },
  { description: '家里有凳子、弹力带等基础器械', icon: 'home-outline', label: '家庭基础器械', value: 'home_basic' },
  { description: '以哑铃或杠铃为主', icon: 'barbell-outline', label: '哑铃 / 杠铃', value: 'dumbbell_barbell' },
  { description: '先按通用方案推荐', icon: 'help-outline', label: '不确定', value: 'unknown' },
];

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function dayLabel(value: TrainingDaysPerWeek): string {
  return value === 'flexible' ? '不固定' : `${value}天`;
}

export default function TrainingProfileOnboardingRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(user?.displayName ?? '');
  const [gender, setGender] = useState<TrainingProfileDraft['gender']>();
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bodyweight, setBodyweight] = useState('');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<TrainingDaysPerWeek>(3);
  const [experience, setExperience] = useState<TrainingExperience>('three_to_twelve_months');
  const [equipment, setEquipment] = useState<TrainingEquipment>('full_gym');
  const [squat1RM, setSquat1RM] = useState('');
  const [bench1RM, setBench1RM] = useState('');
  const [deadlift1RM, setDeadlift1RM] = useState('');
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const profile = useMemo<TrainingProfileDraft>(
    () => ({
      age: parseOptionalNumber(age),
      bench1RM: parseOptionalNumber(bench1RM),
      bodyweight: parseOptionalNumber(bodyweight),
      deadlift1RM: parseOptionalNumber(deadlift1RM),
      equipment,
      experience,
      gender,
      goal,
      heightCm: parseOptionalNumber(heightCm),
      nickname: nickname.trim() || user?.displayName,
      squat1RM: parseOptionalNumber(squat1RM),
      trainingDaysPerWeek,
    }),
    [
      age,
      bench1RM,
      bodyweight,
      deadlift1RM,
      equipment,
      experience,
      gender,
      goal,
      heightCm,
      nickname,
      squat1RM,
      trainingDaysPerWeek,
      user?.displayName,
    ],
  );

  const recommendations = useMemo(
    () => recommendPlans(profile, listSystemTrainingSchemes()),
    [profile],
  );
  const selectedRecommendation =
    recommendations.find((item) => item.scheme.id === selectedSchemeId) ?? recommendations[0];

  const applyRecommendedPlan = async () => {
    if (!selectedRecommendation) {
      setNotice({ title: '暂无推荐计划', message: '请先选择训练目标和基础条件。' });
      return;
    }

    setIsWorking(true);
    try {
      await initializeLocalDatabase();
      const group = await repositories.groupRepository.getDefaultGroup();
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }

      const displayName = profile.nickname?.trim() || user?.displayName || '练刻用户';
      const profilePatch = {
        bench1RM: profile.bench1RM,
        bodyweight: profile.bodyweight,
        deadlift1RM: profile.deadlift1RM,
        squat1RM: profile.squat1RM,
      };
      const members = await repositories.memberRepository.listMembers(group.id);
      const currentMember = members[0];
      if (currentMember) {
        await repositories.memberRepository.updateMember(currentMember.id, {
          displayName,
        });
        await repositories.memberRepository.updateProfile(currentMember.id, profilePatch);
      } else {
        await repositories.memberRepository.createMember({
          displayName,
          groupId: group.id,
          role: 'owner',
          profile: profilePatch,
        });
      }

      const plan = await repositories.planRepository.copySystemSchemeToUserPlan({
        name: selectedRecommendation.scheme.title,
        scheme: selectedRecommendation.scheme,
      });
      const phases = await repositories.planRepository.listPlanPhases(plan.id);
      await repositories.groupRepository.updateGroup(group.id, {
        activePlanId: plan.id,
        currentPhaseType: phases[0]?.type ?? 'custom',
        currentWeek: 1,
        fridayEnabled: plan.frequencyPerWeek >= 3,
      });

      router.replace('/(tabs)/today' as never);
    } catch (error) {
      setNotice({
        title: '计划设置失败',
        message: error instanceof Error ? error.message : '使用推荐计划失败，请稍后重试。',
      });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/today' as never)} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
        </View>
        <AppText variant="bodySmall" weight="900">
          {step + 1}/4
        </AppText>
      </View>

      {step === 0 ? (
        <StepProfile
          age={age}
          bodyweight={bodyweight}
          gender={gender}
          heightCm={heightCm}
          nickname={nickname}
          onAgeChange={setAge}
          onBodyweightChange={setBodyweight}
          onGenderChange={setGender}
          onHeightChange={setHeightCm}
          onNicknameChange={setNickname}
        />
      ) : null}

      {step === 1 ? (
        <StepGoal
          goal={goal}
          onGoalChange={setGoal}
          onTrainingDaysChange={setTrainingDaysPerWeek}
          trainingDaysPerWeek={trainingDaysPerWeek}
        />
      ) : null}

      {step === 2 ? (
        <StepBase
          bench1RM={bench1RM}
          deadlift1RM={deadlift1RM}
          equipment={equipment}
          experience={experience}
          onBenchChange={setBench1RM}
          onDeadliftChange={setDeadlift1RM}
          onEquipmentChange={setEquipment}
          onExperienceChange={setExperience}
          onSquatChange={setSquat1RM}
          squat1RM={squat1RM}
        />
      ) : null}

      {step === 3 ? (
        <StepRecommendation
          onSelectScheme={setSelectedSchemeId}
          recommendations={recommendations}
          selectedSchemeId={selectedRecommendation?.scheme.id}
        />
      ) : null}

      <View style={styles.footer}>
        {step > 0 ? (
          <AppButton onPress={() => setStep((current) => Math.max(0, current - 1))} variant="secondary">
            上一步
          </AppButton>
        ) : null}
        {step < 3 ? (
          <AppButton onPress={() => setStep((current) => Math.min(3, current + 1))} style={styles.primaryAction}>
            下一步
          </AppButton>
        ) : (
          <AppButton loading={isWorking} onPress={() => void applyRecommendedPlan()} style={styles.primaryAction}>
            使用此计划
          </AppButton>
        )}
      </View>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

function StepTitle({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.stepTitle}>
      <AppText variant="headline" weight="900">
        {title}
      </AppText>
      <AppText tone="muted" variant="bodySmall">
        {subtitle}
      </AppText>
    </View>
  );
}

function InfoInputRow({
  icon,
  keyboard = 'default',
  label,
  onChangeText,
  placeholder,
  suffix,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  keyboard?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix?: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <AppText style={styles.infoLabel} variant="bodySmall" weight="900">
        {label}
      </AppText>
      <TextInput
        keyboardType={keyboard}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
      {suffix ? (
        <AppText tone="muted" variant="bodySmall">
          {suffix}
        </AppText>
      ) : null}
    </View>
  );
}

function StepProfile({
  age,
  bodyweight,
  gender,
  heightCm,
  nickname,
  onAgeChange,
  onBodyweightChange,
  onGenderChange,
  onHeightChange,
  onNicknameChange,
}: {
  age: string;
  bodyweight: string;
  gender?: TrainingProfileDraft['gender'];
  heightCm: string;
  nickname: string;
  onAgeChange: (value: string) => void;
  onBodyweightChange: (value: string) => void;
  onGenderChange: (value: TrainingProfileDraft['gender']) => void;
  onHeightChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
}) {
  return (
    <>
      <StepTitle subtitle="这些信息会用于推荐更合适的训练计划" title="完善训练信息" />
      <AppCard style={styles.formCard}>
        <InfoInputRow icon="person-outline" label="昵称" onChangeText={onNicknameChange} placeholder="练刻用户" value={nickname} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons color={colors.primary} name="male-female-outline" size={18} />
          </View>
          <AppText style={styles.infoLabel} variant="bodySmall" weight="900">
            性别
          </AppText>
          <View style={styles.segmentRow}>
            {[
              ['male', '男'],
              ['female', '女'],
              ['other', '其他'],
            ].map(([value, label]) => (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => onGenderChange(value as TrainingProfileDraft['gender'])}
                style={[styles.segment, gender === value && styles.segmentActive]}
              >
                <AppText style={gender === value && styles.segmentTextActive} variant="caption" weight="900">
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        <InfoInputRow icon="calendar-outline" keyboard="number-pad" label="年龄" onChangeText={onAgeChange} placeholder="可跳过" suffix="岁" value={age} />
        <InfoInputRow icon="resize-outline" keyboard="number-pad" label="身高" onChangeText={onHeightChange} placeholder="可跳过" suffix="cm" value={heightCm} />
        <InfoInputRow icon="scale-outline" keyboard="number-pad" label="体重" onChangeText={onBodyweightChange} placeholder="可跳过" suffix="kg" value={bodyweight} />
      </AppCard>
    </>
  );
}

function StepGoal({
  goal,
  onGoalChange,
  onTrainingDaysChange,
  trainingDaysPerWeek,
}: {
  goal: TrainingGoal;
  onGoalChange: (value: TrainingGoal) => void;
  onTrainingDaysChange: (value: TrainingDaysPerWeek) => void;
  trainingDaysPerWeek: TrainingDaysPerWeek;
}) {
  return (
    <>
      <StepTitle subtitle="选择你的主要目标和每周可训练天数" title="训练目标与频率" />
      <View style={styles.choiceList}>
        {goalOptions.map((option) => {
          const active = option.value === goal;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onGoalChange(option.value)}
              style={[styles.goalCard, active && styles.cardActive]}
            >
              <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
                <Ionicons color={active ? colors.surface : colors.primary} name={option.icon} size={21} />
              </View>
              <View style={styles.choiceText}>
                <AppText variant="bodySmall" weight="900">
                  {option.label}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {option.description}
                </AppText>
              </View>
              {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pillSection}>
        <AppText variant="subtitle" weight="900">
          每周可训练天数
        </AppText>
        <View style={styles.pillRow}>
          {dayOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={String(option)}
              onPress={() => onTrainingDaysChange(option)}
              style={[styles.pill, option === trainingDaysPerWeek && styles.pillActive]}
            >
              <AppText style={option === trainingDaysPerWeek && styles.pillTextActive} variant="bodySmall" weight="900">
                {dayLabel(option)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

function StepBase({
  bench1RM,
  deadlift1RM,
  equipment,
  experience,
  onBenchChange,
  onDeadliftChange,
  onEquipmentChange,
  onExperienceChange,
  onSquatChange,
  squat1RM,
}: {
  bench1RM: string;
  deadlift1RM: string;
  equipment: TrainingEquipment;
  experience: TrainingExperience;
  onBenchChange: (value: string) => void;
  onDeadliftChange: (value: string) => void;
  onEquipmentChange: (value: TrainingEquipment) => void;
  onExperienceChange: (value: TrainingExperience) => void;
  onSquatChange: (value: string) => void;
  squat1RM: string;
}) {
  return (
    <>
      <StepTitle subtitle="告诉我们你的经验和器械条件，基础力量可跳过" title="训练基础" />
      <View style={styles.choiceList}>
        {experienceOptions.map((option) => {
          const active = option.value === experience;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onExperienceChange(option.value)}
              style={[styles.goalCard, active && styles.cardActive]}
            >
              <View style={styles.choiceText}>
                <AppText variant="bodySmall" weight="900">
                  {option.label}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {option.description}
                </AppText>
              </View>
              {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.equipmentGrid}>
        {equipmentOptions.map((option) => {
          const active = option.value === equipment;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onEquipmentChange(option.value)}
              style={[styles.equipmentCard, active && styles.cardActive]}
            >
              <View style={[styles.choiceIcon, active && styles.choiceIconActive]}>
                <Ionicons color={active ? colors.surface : colors.primary} name={option.icon} size={19} />
              </View>
              <AppText variant="caption" weight="900">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppCard style={styles.formCard}>
        <View style={styles.formHeader}>
          <AppText variant="subtitle" weight="900">
            基础力量
          </AppText>
          <AppText tone="muted" variant="caption">
            可跳过；填写后会保存到当前成员档案。
          </AppText>
        </View>
        <InfoInputRow icon="barbell-outline" keyboard="number-pad" label="深蹲 1RM" onChangeText={onSquatChange} placeholder="kg" value={squat1RM} />
        <InfoInputRow icon="barbell-outline" keyboard="number-pad" label="卧推 1RM" onChangeText={onBenchChange} placeholder="kg" value={bench1RM} />
        <InfoInputRow icon="barbell-outline" keyboard="number-pad" label="硬拉 1RM" onChangeText={onDeadliftChange} placeholder="kg" value={deadlift1RM} />
      </AppCard>
    </>
  );
}

function StepRecommendation({
  onSelectScheme,
  recommendations,
  selectedSchemeId,
}: {
  onSelectScheme: (schemeId: string) => void;
  recommendations: ReturnType<typeof recommendPlans>;
  selectedSchemeId?: string;
}) {
  const primary = recommendations.find((item) => item.scheme.id === selectedSchemeId) ?? recommendations[0];
  const alternatives = recommendations.filter((item) => item.scheme.id !== primary?.scheme.id);

  return (
    <>
      <StepTitle subtitle="基于你的信息，推荐以下训练计划" title="推荐计划" />
      {primary ? (
        <AppCard style={styles.recommendCard} tone="dark">
          <View style={styles.recommendHeader}>
            <View style={styles.targetIcon}>
              <Ionicons color={colors.surface} name="locate-outline" size={24} />
            </View>
            <Tag label="推荐" tone="danger" />
          </View>
          <AppText style={styles.recommendMeta} variant="bodySmall" weight="900">
            推荐给你：
          </AppText>
          <AppText style={styles.recommendTitle} variant="headline" weight="900">
            {primary.scheme.title}
          </AppText>
          <View style={styles.recommendFacts}>
            <Fact label="目标" value={primary.scheme.tags[0] ?? '训练'} />
            <Fact label="频率" value={`每周 ${primary.scheme.frequencyPerWeek} 天`} />
            <Fact label="经验" value={primary.scheme.experienceRequirement} />
            <Fact label="器械" value={primary.scheme.equipmentRequirement} />
          </View>
          <AppCard style={styles.structureCard}>
            <AppText variant="bodySmall" weight="900">
              计划结构
            </AppText>
            <AppText tone="muted" variant="caption">
              {primary.scheme.dayStructure}
            </AppText>
            <AppText tone="muted" variant="caption">
              {primary.reasons[0] ?? primary.scheme.recommendationReason}
            </AppText>
          </AppCard>
        </AppCard>
      ) : null}

      {alternatives.length > 0 ? (
        <View style={styles.choiceList}>
          {alternatives.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.scheme.id}
              onPress={() => onSelectScheme(item.scheme.id)}
              style={styles.altPlan}
            >
              <View style={styles.choiceText}>
                <AppText variant="bodySmall" weight="900">
                  备选：{item.scheme.title}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {item.scheme.subtitle}
                </AppText>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <AppText style={styles.factLabel} variant="caption" weight="900">
        {label}
      </AppText>
      <AppText numberOfLines={1} style={styles.factValue} variant="caption">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  altPlan: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 70,
    padding: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  choiceIconActive: {
    backgroundColor: colors.primary,
  },
  choiceList: {
    gap: spacing.sm,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  equipmentCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minHeight: 92,
    minWidth: '45%',
    padding: spacing.md,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factLabel: {
    color: colors.primary,
    minWidth: 34,
  },
  factRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  factValue: {
    color: colors.surface,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formCard: {
    gap: spacing.md,
  },
  formHeader: {
    gap: 2,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoLabel: {
    flex: 0.8,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
  },
  input: {
    color: colors.textStrong,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 42,
    textAlign: 'right',
  },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pillSection: {
    gap: spacing.sm,
  },
  pillTextActive: {
    color: colors.primary,
  },
  primaryAction: {
    flex: 1,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  recommendCard: {
    gap: spacing.md,
  },
  recommendFacts: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  recommendHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recommendMeta: {
    color: 'rgba(255,255,255,0.78)',
  },
  recommendTitle: {
    color: colors.surface,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    minHeight: 34,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentTextActive: {
    color: colors.surface,
  },
  stepTitle: {
    gap: spacing.xs,
  },
  structureCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  targetIcon: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.36)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
