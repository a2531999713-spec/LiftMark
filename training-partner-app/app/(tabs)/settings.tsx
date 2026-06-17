import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentProps, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { liftmarkBrandAssets } from '@/assets/brand';
import { AppButton, AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, getDatabase, initializeLocalDatabase } from '@/data/local';
import { createActivationService } from '@/services/activationService';
import { exportLocalDataJson, exportWorkoutDataJson, resetDefaultPlanData } from '@/services/exportService';
import { pickImportedPlanDocument } from '@/services/planDocumentService';
import { createCurrentPlanFile, PlanFileError, serializePlanFile } from '@/services/planFileService';
import { getTrialDaysLeft } from '@/domain/activation/activation.service';
import type { ActivationState } from '@/domain/activation/activation.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { PhaseType, PlanTemplate } from '@/domain/plan/plan.types';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Diagnostics = {
  databaseVersion: number;
  exerciseCount: number;
  planCount: number;
  seedStatus: string;
  sqliteStatus: string;
};

type CountRow = {
  count: number;
};

type NoticeState = {
  message: string;
  title: string;
};

type ExportPrompt = {
  content: string;
  message: string;
  title: string;
};

type ActivationPrompt = {
  message: string;
  plan: PlanTemplate;
  title: string;
};

async function loadDiagnostics(): Promise<Diagnostics> {
  await initializeLocalDatabase();
  const db = await getDatabase();
  const exerciseCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM exercises');
  const planCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM plan_templates');
  const migration = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );

  return {
    databaseVersion: migration?.version ?? 0,
    exerciseCount: exerciseCount?.count ?? 0,
    planCount: planCount?.count ?? 0,
    seedStatus: (exerciseCount?.count ?? 0) > 0 && (planCount?.count ?? 0) > 0 ? '已初始化' : '待初始化',
    sqliteStatus: '已连接',
  };
}

function formatMembersValue(members: GroupMember[]) {
  return members.length > 0 ? `${members.length} 位成员` : '添加成员';
}

function formatMembersDescription(members: GroupMember[]) {
  if (members.length === 0) {
    return '管理本地训练成员资料';
  }

  return members.map((member) => member.displayName).join(' / ');
}

function formatMemberUnitsDescription(members: GroupMember[], profilesByMemberId: Record<string, MemberProfile | null>) {
  if (members.length === 0) {
    return '按成员分别设置杠铃 / 哑铃加重单位';
  }

  return members
    .map((member) => {
      const profile = profilesByMemberId[member.id];
      return `${member.displayName} ${profile?.barbellIncrement ?? 2.5}/${profile?.dumbbellIncrement ?? 2}kg`;
    })
    .join(' · ');
}

export default function SettingsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const activationService = useMemo(() => createActivationService(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesByMemberId, setProfilesByMemberId] = useState<Record<string, MemberProfile | null>>({});
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [activation, setActivation] = useState<ActivationState | null>(null);
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);
  const [exportPrompt, setExportPrompt] = useState<ExportPrompt | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const nextMembers = await repositories.memberRepository.listMembers(nextGroup.id);
      const profiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );

      setGroup(nextGroup);
      setMembers(nextMembers);
      setProfilesByMemberId(Object.fromEntries(profiles));
      setDiagnostics(await loadDiagnostics());
      setActivation(await activationService.getState());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '设置加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [activationService, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const showExportSuccess = useCallback((title: string, json: string) => {
    setExportPrompt({
      content: json,
      title,
      message: `内容已生成，大小约 ${Math.ceil(json.length / 1024)} KB。当前版本暂未保存到文件，你可以先复制内容；后续版本会接入保存和分享。`,
    });
  }, []);

  const copyExportContent = useCallback(async () => {
    if (!exportPrompt) {
      return;
    }

    await Clipboard.setStringAsync(exportPrompt.content);
    setExportPrompt(null);
    setNotice({
      title: '已复制内容',
      message: '导出内容已复制到剪贴板。当前版本还不会自动保存文件。',
    });
  }, [exportPrompt]);

  const resolvePhaseTypeForPlan = useCallback(
    async (planId: string): Promise<PhaseType> => {
      const phases = await repositories.planRepository.listPlanPhases(planId);
      return phases[0]?.type ?? 'custom';
    },
    [repositories],
  );

  const setCurrentPlan = useCallback(
    async (plan: PlanTemplate) => {
      const currentGroup = await repositories.groupRepository.getDefaultGroup();
      if (!currentGroup) {
        setNotice({ title: '设置失败', message: '默认小组尚未初始化。' });
        return;
      }

      setIsWorking(true);
      try {
        const updatedGroup = await repositories.groupRepository.updateGroup(currentGroup.id, {
          activePlanId: plan.id,
          currentPhaseType: await resolvePhaseTypeForPlan(plan.id),
          currentWeek: 1,
        });
        setGroup(updatedGroup);
        setActivationPrompt(null);
        setNotice({
          title: '已设为当前计划',
          message: `训练页将读取"${plan.name}"。历史记录不会受影响。`,
        });
      } catch (error) {
        setNotice({ title: '设置失败', message: error instanceof Error ? error.message : '设置当前计划失败。' });
      } finally {
        setIsWorking(false);
      }
    },
    [repositories, resolvePhaseTypeForPlan],
  );

  const exportAllData = useCallback(async () => {
    setIsWorking(true);
    try {
      showExportSuccess('导出全部数据', await exportLocalDataJson());
    } catch (exportError) {
      setNotice({ title: '导出失败', message: exportError instanceof Error ? exportError.message : '导出全部数据失败。' });
    } finally {
      setIsWorking(false);
    }
  }, [showExportSuccess]);

  const exportWorkoutData = useCallback(async () => {
    setIsWorking(true);
    try {
      showExportSuccess('导出训练记录', await exportWorkoutDataJson());
    } catch (exportError) {
      setNotice({ title: '导出失败', message: exportError instanceof Error ? exportError.message : '导出训练记录失败。' });
    } finally {
      setIsWorking(false);
    }
  }, [showExportSuccess]);

  const exportCurrentPlan = useCallback(async () => {
    if (!group) {
      return;
    }

    setIsWorking(true);
    try {
      const planFile = await createCurrentPlanFile(repositories, group.activePlanId);
      showExportSuccess('导出当前计划', serializePlanFile(planFile));
    } catch (exportError) {
      setNotice({ title: '导出失败', message: exportError instanceof Error ? exportError.message : '导出当前计划失败。' });
    } finally {
      setIsWorking(false);
    }
  }, [group, repositories, showExportSuccess]);

  const importPlan = useCallback(async () => {
    setIsWorking(true);
    try {
      const picked = await pickImportedPlanDocument();
      if (!picked) {
        return;
      }

      const importedPlan = await repositories.planRepository.importUserPlan({
        alternatives: picked.draft.alternatives,
        days: picked.draft.plan.days,
        exercises: picked.draft.exercises,
        phases: picked.draft.plan.phases,
        planExercises: picked.draft.plan.exercises,
        template: picked.draft.plan.template,
      });
      await loadSettings();

      setActivationPrompt({
        plan: importedPlan,
        title: '计划已导入',
        message: `"${importedPlan.name}"已成为我的计划。是否设为当前训练计划？`,
      });
    } catch (importError) {
      if (importError instanceof PlanFileError) {
        setNotice({
          title: '计划文件格式不兼容',
          message: '这个文件不是练刻 LiftMark 支持的计划文件。',
        });
        return;
      }

      setNotice({ title: '导入失败', message: importError instanceof Error ? importError.message : '计划导入失败。' });
    } finally {
      setIsWorking(false);
    }
  }, [loadSettings, repositories]);

  const confirmResetDefaultPlan = useCallback(() => {
    Alert.alert('重置默认计划？', '将重新检查系统方案 seed，并补齐缺失的用户计划副本，不会删除已有训练记录。确认继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsWorking(true);
            try {
              await resetDefaultPlanData();
              await loadSettings();
              setNotice({ title: '已完成', message: '默认计划数据已重新检查并写入缺失数据。' });
            } catch (resetError) {
              setNotice({ title: '重置失败', message: resetError instanceof Error ? resetError.message : '重置默认计划失败。' });
            } finally {
              setIsWorking(false);
            }
          })();
        },
      },
    ]);
  }, [loadSettings]);

  const confirmDanger = useCallback((title: string) => {
    Alert.alert(title, '这是危险操作。为了避免误删真实训练数据，本版本只保留入口和二次确认。', [
      { text: '取消', style: 'cancel' },
      {
        text: '我知道了',
        style: 'destructive',
        onPress: () =>
          setNotice({
            title,
            message: '当前版本不会执行该危险操作，真实训练记录仍保存在本机 SQLite。',
          }),
      },
    ]);
  }, []);

  return (
    <Screen>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {error ? <EmptyState title="设置暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <View style={styles.sections}>
          <BrandCard activation={activation} group={group} members={members} />

          <SettingsSection title="通用设置">
            <SettingsCell
              icon="people-outline"
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="当前小组"
              trailing={group?.name ?? '本地训练小组'}
            />
            <SettingsCell
              description={formatMembersDescription(members)}
              icon="person-circle-outline"
              iconBg={colors.accentSoft}
              iconColor={colors.accent}
              label="成员资料"
              onPress={() => router.push('/settings/members')}
              trailing={formatMembersValue(members)}
            />
            <SettingsCell
              description="同一设备多人轮换，本机保存"
              icon="information-circle-outline"
              iconBg={colors.successSoft}
              iconColor={colors.success}
              label="本地小组规则"
              onPress={() =>
                setNotice({
                  title: '本地小组规则',
                  message:
                    '当前版本的小组适合同一台设备多人轮换记录，数据保存在本机，不会自动同步到其他手机。组长可以查看本机保存的所有本地成员训练数据；未来云同步版本再支持账号登录、邀请成员加入、多设备同步，以及组长查看成员授权共享的数据。',
                })
              }
              trailing="了解"
            />
          </SettingsSection>

          <SettingsSection title="训练设置">
            <SettingsCell
              icon="scale-outline"
              iconBg={colors.warningSoft}
              iconColor={colors.warning}
              label="默认单位"
              trailing="kg"
            />
            <SettingsCell
              description={formatMemberUnitsDescription(members, profilesByMemberId)}
              icon="barbell-outline"
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="加重单位"
              onPress={() => router.push('/settings/member-units')}
              trailing={formatMembersValue(members)}
            />
            <SettingsCell
              icon="pulse-outline"
              iconBg={colors.accentSoft}
              iconColor={colors.accent}
              label="默认记录方式"
              trailing="RPE / RIR"
            />
          </SettingsSection>

          <SettingsSection title="试用与激活">
            <SettingsCell
              icon="shield-checkmark-outline"
              iconBg={activation?.isActivated ? colors.successSoft : colors.warningSoft}
              iconColor={activation?.isActivated ? colors.success : colors.warning}
              label="当前模式"
              trailing={activation?.isActivated ? '已激活' : '试用模式'}
              trailingTone={activation?.isActivated ? 'success' : 'warning'}
            />
            <SettingsCell
              icon="time-outline"
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="试用剩余天数"
              trailing={`${activation ? getTrialDaysLeft(activation) : 0} 天`}
            />
            <SettingsCell
              description={activation?.deviceId ?? '生成中'}
              icon="phone-portrait-outline"
              iconBg={colors.surfaceMuted}
              iconColor={colors.textMuted}
              label="设备 ID"
            />
            <SettingsCell
              icon="key-outline"
              iconBg={colors.brandSoft}
              iconColor={colors.brand}
              label="输入激活码"
              onPress={() => router.push('/activation' as never)}
              trailing="打开"
            />
          </SettingsSection>

          <SettingsSection title="数据管理">
            <SettingsCell
              disabled={isWorking}
              icon="download-outline"
              iconBg={colors.accentSoft}
              iconColor={colors.accent}
              label="导出全部数据"
              onPress={() => void exportAllData()}
            />
            <SettingsCell
              disabled={isWorking}
              icon="document-text-outline"
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="导出当前计划"
              onPress={() => void exportCurrentPlan()}
            />
            <SettingsCell
              disabled={isWorking}
              icon="bar-chart-outline"
              iconBg={colors.successSoft}
              iconColor={colors.success}
              label="导出训练记录"
              onPress={() => void exportWorkoutData()}
            />
            <SettingsCell
              disabled={isWorking}
              icon="cloud-upload-outline"
              iconBg={colors.brandSoft}
              iconColor={colors.brand}
              label="导入计划"
              onPress={() => void importPlan()}
              trailing="选择文件"
            />
            <SettingsCell
              icon="server-outline"
              iconBg={colors.surfaceMuted}
              iconColor={colors.textMuted}
              label="备份数据库"
              onPress={() => setNotice({ title: '备份数据库', message: '文件保存和分享能力接入后开放。当前训练记录仍保存在本机 SQLite。' })}
              tag="开发中"
            />
            <SettingsCell
              icon="refresh-outline"
              iconBg={colors.surfaceMuted}
              iconColor={colors.textMuted}
              label="恢复数据库"
              onPress={() => setNotice({ title: '恢复数据库', message: '恢复能力会在备份文件校验完成后开放，当前版本不会覆盖本机数据。' })}
              tag="开发中"
            />
          </SettingsSection>

          <SettingsSection title="计划管理">
            <SettingsCell
              description="补齐缺失 seed，不删除已有训练记录"
              disabled={isWorking}
              icon="reload-outline"
              iconBg={colors.warningSoft}
              iconColor={colors.warning}
              label="重置默认计划"
              onPress={confirmResetDefaultPlan}
              trailing="执行"
            />
            <SettingsCell
              icon="layers-outline"
              iconBg={colors.accentSoft}
              iconColor={colors.accent}
              label="系统方案版本"
              onPress={() =>
                setNotice({
                  title: '系统方案版本',
                  message: '系统方案版本：1。四练增力增肌与经典三分化 PPL 已可复制使用，其他方案会逐步补齐。',
                })
              }
              trailing={`${diagnostics?.planCount ?? 0} 个模板`}
            />
          </SettingsSection>

          <SettingsSection title="关于">
            <SettingsCell
              icon="sparkles-outline"
              iconBg={colors.brandSoft}
              iconColor={colors.brand}
              label="关于练刻"
              onPress={() => router.push('/about' as never)}
              trailing={Constants.expoConfig?.version ?? '0.1.0'}
            />
          </SettingsSection>

          <SettingsSection title="开发与诊断">
            <SettingsCell
              icon="server-outline"
              iconBg={colors.surfaceMuted}
              iconColor={colors.textMuted}
              label="SQLite 状态"
              trailing={diagnostics?.sqliteStatus ?? '未知'}
            />
            <SettingsCell
              icon="git-branch-outline"
              iconBg={colors.surfaceMuted}
              iconColor={colors.textMuted}
              label="数据库版本"
              trailing={`${diagnostics?.databaseVersion ?? 0}`}
            />
            <SettingsCell
              icon="leaf-outline"
              iconBg={colors.successSoft}
              iconColor={colors.success}
              label="seed 状态"
              trailing={diagnostics?.seedStatus ?? '未知'}
            />
            <SettingsCell
              icon="people-outline"
              iconBg={colors.accentSoft}
              iconColor={colors.accent}
              label="成员数量"
              trailing={`${members.length}`}
            />
            <SettingsCell
              icon="fitness-outline"
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="动作数量"
              trailing={`${diagnostics?.exerciseCount ?? 0}`}
            />
          </SettingsSection>

          <SettingsSection title="危险操作" danger>
            <SettingsCell
              danger
              disabled={isWorking}
              icon="warning-outline"
              label="清空测试数据"
              onPress={() => confirmDanger('清空测试数据')}
            />
            <SettingsCell
              danger
              disabled={isWorking}
              icon="trash-outline"
              label="清空训练记录"
              onPress={() => confirmDanger('清空训练记录')}
            />
            <SettingsCell
              danger
              disabled={isWorking}
              icon="nuclear-outline"
              label="重置整个 App"
              onPress={() => confirmDanger('重置整个 App')}
            />
          </SettingsSection>
        </View>
      ) : null}

      <AppModalSheet
        onClose={() => setExportPrompt(null)}
        subtitle={exportPrompt?.message}
        title={exportPrompt?.title ?? '内容已生成'}
        visible={Boolean(exportPrompt)}
      >
        <View style={styles.modalActions}>
          <AppButton disabled={isWorking} onPress={() => void copyExportContent()}>
            复制内容
          </AppButton>
          <AppButton onPress={() => setExportPrompt(null)} variant="secondary">
            知道了
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setActivationPrompt(null)}
        subtitle={activationPrompt?.message}
        title={activationPrompt?.title ?? '计划已导入'}
        visible={Boolean(activationPrompt)}
      >
        <View style={styles.modalActions}>
          <AppButton onPress={() => setActivationPrompt(null)} variant="secondary">
            稍后
          </AppButton>
          <AppButton disabled={isWorking} onPress={() => (activationPrompt ? void setCurrentPlan(activationPrompt.plan) : undefined)}>
            设为当前
          </AppButton>
        </View>
      </AppModalSheet>

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

function BrandCard({
  activation,
  group,
  members,
}: {
  activation: ActivationState | null;
  group: Group | null;
  members: GroupMember[];
}) {
  return (
    <View style={styles.brandCard}>
      <View style={styles.brandCardInner}>
        <View style={styles.brandCardHeader}>
          <Image resizeMode="contain" source={liftmarkBrandAssets.logoPrimary} style={styles.brandLogo} />
          <Tag label={activation?.isActivated ? '已激活' : '试用模式'} tone={activation?.isActivated ? 'success' : 'warning'} />
        </View>

        <View style={styles.brandCardBody}>
          <AppText variant="subtitle" weight="900">
            练刻 LiftMark
          </AppText>
          <AppText tone="muted" variant="caption">
            你的力量训练计划执行器
          </AppText>
        </View>

        <View style={styles.brandCardStats}>
          <BrandStat label="成员" value={`${members.length}`} />
          <View style={styles.brandStatDivider} />
          <BrandStat label="小组" value={group?.name ?? '本地'} />
          <View style={styles.brandStatDivider} />
          <BrandStat label="同步" value="本机" />
        </View>
      </View>
    </View>
  );
}

function BrandStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.brandStat}>
      <AppText variant="body" weight="900">
        {value}
      </AppText>
      <AppText tone="subtle" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function SettingsSection({
  children,
  danger = false,
  title,
}: {
  children: ReactNode;
  danger?: boolean;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <AppText
        style={[styles.sectionTitle, danger && styles.sectionTitleDanger]}
        variant="caption"
        weight="800"
      >
        {title}
      </AppText>
      <View style={[styles.sectionCard, danger && styles.sectionCardDanger]}>
        {children}
      </View>
    </View>
  );
}

function SettingsCell({
  danger = false,
  description,
  disabled = false,
  icon,
  iconBg,
  iconColor,
  label,
  onPress,
  tag,
  trailing,
  trailingTone,
}: {
  danger?: boolean;
  description?: string;
  disabled?: boolean;
  icon: IconName;
  iconBg?: string;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  tag?: string;
  trailing?: string;
  trailingTone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const isPressable = Boolean(onPress);
  const iconBackground = danger ? colors.dangerSoft : iconBg ?? colors.primarySoft;
  const iconForeground = danger ? colors.danger : iconColor ?? colors.primary;

  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : undefined}
      disabled={disabled || !isPressable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        disabled && styles.cellDisabled,
        pressed && isPressable && styles.cellPressed,
      ]}
    >
      <View style={[styles.cellIcon, { backgroundColor: iconBackground }]}>
        <Ionicons color={iconForeground} name={icon} size={18} />
      </View>

      <View style={styles.cellBody}>
        <AppText tone={danger ? 'danger' : 'default'} variant="body" weight="600">
          {label}
        </AppText>
        {description ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>

      <View style={styles.cellTrailing}>
        {tag ? <Tag label={tag} tone="neutral" /> : null}
        {trailing ? (
          <AppText
            numberOfLines={1}
            style={styles.trailingText}
            tone={trailingTone === 'success' ? 'success' : trailingTone === 'warning' ? 'warning' : 'muted'}
            variant="caption"
            weight="600"
          >
            {trailing}
          </AppText>
        ) : null}
        {isPressable ? (
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  sections: {
    gap: spacing.xl,
  },

  brandCard: {
    backgroundColor: colors.darkCard,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.brand,
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  brandCardInner: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  brandCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandLogo: {
    height: 40,
    width: 120,
  },
  brandCardBody: {
    gap: spacing.xs,
  },
  brandCardStats: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  brandStat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  brandStatDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 24,
    width: 1,
  },

  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
    textTransform: 'uppercase',
  },
  sectionTitleDanger: {
    color: colors.danger,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionCardDanger: {
    borderColor: colors.dangerSoft,
  },

  cell: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cellDisabled: {
    opacity: 0.45,
  },
  cellPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cellIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  cellBody: {
    flex: 1,
    gap: 1,
  },
  cellTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trailingText: {
    maxWidth: 120,
  },

  modalActions: {
    gap: spacing.sm,
  },
});
