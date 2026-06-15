import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentProps, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { liftmarkBrandAssets } from '@/assets/brand';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
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
          message: `训练页将读取“${plan.name}”。历史记录不会受影响。`,
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
        message: `“${importedPlan.name}”已成为我的计划。是否设为当前训练计划？`,
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
    <Screen title="设置" subtitle="本地数据、训练偏好与应用状态。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="设置暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <SettingsHero activation={activation} group={group} members={members} />

          <SettingsGroup title="通用设置">
            <SettingsItem icon="people-outline" title="当前小组" value={group?.name ?? '本地训练小组'} />
            <SettingsItem
              description={formatMembersDescription(members)}
              icon="person-circle-outline"
              onPress={() => router.push('/settings/members')}
              title="成员资料"
              value={formatMembersValue(members)}
            />
            <SettingsItem
              description="同一设备多人轮换，本机保存"
              icon="information-circle-outline"
              onPress={() =>
                setNotice({
                  title: '本地小组规则',
                  message:
                    '当前版本的小组适合同一台设备多人轮换记录，数据保存在本机，不会自动同步到其他手机。组长可以查看本机保存的所有本地成员训练数据；未来云同步版本再支持账号登录、邀请成员加入、多设备同步，以及组长查看成员授权共享的数据。',
                })
              }
              title="本地小组规则"
              value="了解"
            />
            <SettingsItem
              icon="sparkles-outline"
              onPress={() => router.push('/about' as never)}
              title="关于练刻"
              value={Constants.expoConfig?.version ?? '0.1.0'}
            />
          </SettingsGroup>

          <SettingsGroup title="训练设置">
            <SettingsItem icon="scale-outline" title="默认单位" value="kg" />
            <SettingsItem
              description={formatMemberUnitsDescription(members, profilesByMemberId)}
              icon="barbell-outline"
              onPress={() => router.push('/settings/member-units')}
              title="加重单位"
              value={formatMembersValue(members)}
            />
            <SettingsItem icon="pulse-outline" title="默认记录方式" value="RPE / RIR" />
          </SettingsGroup>

          <SettingsGroup title="试用与激活">
            <SettingsItem
              icon="shield-checkmark-outline"
              title="当前模式"
              value={activation?.isActivated ? '已激活' : '试用模式'}
            />
            <SettingsItem icon="time-outline" title="试用剩余天数" value={`${activation ? getTrialDaysLeft(activation) : 0} 天`} />
            <SettingsItem description={activation?.deviceId ?? '生成中'} icon="phone-portrait-outline" title="设备 ID" />
            <SettingsItem icon="key-outline" onPress={() => router.push('/activation' as never)} title="输入激活码" value="打开" />
          </SettingsGroup>

          <SettingsGroup title="数据管理">
            <SettingsItem disabled={isWorking} icon="download-outline" onPress={() => void exportAllData()} title="导出全部数据" />
            <SettingsItem disabled={isWorking} icon="document-text-outline" onPress={() => void exportCurrentPlan()} title="导出当前计划" />
            <SettingsItem disabled={isWorking} icon="bar-chart-outline" onPress={() => void exportWorkoutData()} title="导出训练记录" />
            <SettingsItem disabled={isWorking} icon="cloud-upload-outline" onPress={() => void importPlan()} title="导入计划" value="选择文件" />
            <SettingsItem
              icon="server-outline"
              onPress={() => setNotice({ title: '备份数据库', message: '文件保存和分享能力接入后开放。当前训练记录仍保存在本机 SQLite。' })}
              tag="开发中"
              title="备份数据库"
            />
            <SettingsItem
              icon="refresh-outline"
              onPress={() => setNotice({ title: '恢复数据库', message: '恢复能力会在备份文件校验完成后开放，当前版本不会覆盖本机数据。' })}
              tag="开发中"
              title="恢复数据库"
            />
          </SettingsGroup>

          <SettingsGroup title="计划管理">
            <SettingsItem
              disabled={isWorking}
              description="补齐缺失 seed，不删除已有训练记录"
              icon="reload-outline"
              onPress={confirmResetDefaultPlan}
              title="重置默认计划"
              value="执行"
            />
            <SettingsItem
              icon="layers-outline"
              onPress={() =>
                setNotice({
                  title: '系统方案版本',
                  message: '系统方案版本：1。四练增力增肌与经典三分化 PPL 已可复制使用，其他方案会逐步补齐。',
                })
              }
              title="系统方案版本"
              value={`${diagnostics?.planCount ?? 0} 个模板`}
            />
          </SettingsGroup>

          <SettingsGroup title="开发与诊断">
            <SettingsItem icon="server-outline" title="SQLite 状态" value={diagnostics?.sqliteStatus ?? '未知'} />
            <SettingsItem icon="git-branch-outline" title="数据库版本" value={`${diagnostics?.databaseVersion ?? 0}`} />
            <SettingsItem icon="leaf-outline" title="seed 状态" value={diagnostics?.seedStatus ?? '未知'} />
            <SettingsItem icon="people-outline" title="成员数量" value={`${members.length}`} />
            <SettingsItem icon="fitness-outline" title="动作数量" value={`${diagnostics?.exerciseCount ?? 0}`} />
          </SettingsGroup>

          <SettingsGroup title="危险操作" tone="danger">
            <SettingsItem destructive disabled={isWorking} icon="warning-outline" onPress={() => confirmDanger('清空测试数据')} title="清空测试数据" />
            <SettingsItem destructive disabled={isWorking} icon="trash-outline" onPress={() => confirmDanger('清空训练记录')} title="清空训练记录" />
            <SettingsItem destructive disabled={isWorking} icon="nuclear-outline" onPress={() => confirmDanger('重置整个 App')} title="重置整个 App" />
          </SettingsGroup>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setExportPrompt(null)}
        subtitle={exportPrompt?.message}
        title={exportPrompt?.title ?? '内容已生成'}
        visible={Boolean(exportPrompt)}
      >
        <View style={styles.modalButtons}>
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
        <View style={styles.modalButtons}>
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

function SettingsHero({
  activation,
  group,
  members,
}: {
  activation: ActivationState | null;
  group: Group | null;
  members: GroupMember[];
}) {
  return (
    <AppCard style={styles.heroCard} tone="dark">
      <View style={styles.heroTop}>
        <Image resizeMode="contain" source={liftmarkBrandAssets.logoPrimary} style={styles.heroLogo} />
        <Tag label={activation?.isActivated ? '已激活' : '试用模式'} tone="dark" />
      </View>
      <View style={styles.heroText}>
        <AppText tone="inverse" variant="headline">
          练刻 LiftMark
        </AppText>
        <AppText style={styles.heroMutedText} variant="bodySmall">
          你的力量训练计划执行器
        </AppText>
        <AppText style={styles.heroMutedText} variant="caption">
          本地数据 / Android 预览版 / com.liftmark.app
        </AppText>
      </View>
      <View style={styles.heroStats}>
        <HeroStat label="成员" value={`${members.length}`} />
        <HeroStat label="小组" value={group?.name ?? '本地'} />
        <HeroStat label="同步" value="本机" />
      </View>
    </AppCard>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <AppText tone="inverse" variant="bodySmall" weight="900">
        {value}
      </AppText>
      <AppText style={styles.heroMutedText} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function SettingsGroup({
  children,
  title,
  tone = 'default',
}: {
  children: ReactNode;
  title: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <View style={styles.groupSection}>
      <AppText variant="subtitle">{title}</AppText>
      <AppCard style={[styles.groupCard, tone === 'danger' && styles.dangerGroup]}>{children}</AppCard>
    </View>
  );
}

function SettingsItem({
  description,
  destructive = false,
  disabled = false,
  icon,
  onPress,
  tag,
  title,
  value,
}: {
  description?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: IconName;
  onPress?: () => void;
  tag?: string;
  title: string;
  value?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.settingsItem, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
        <Ionicons color={destructive ? colors.danger : colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.itemText}>
        <AppText tone={destructive ? 'danger' : 'default'} variant="bodySmall" weight="900">
          {title}
        </AppText>
        {description ? (
          <AppText numberOfLines={2} tone="muted" variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
      {tag ? <Tag label={tag} tone="neutral" /> : null}
      {value ? (
        <AppText numberOfLines={1} style={styles.itemValue} tone="muted" variant="caption">
          {value}
        </AppText>
      ) : null}
      {onPress ? <Ionicons color={colors.textMuted} name="chevron-forward" size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.lg,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroLogo: {
    height: 58,
    width: 156,
  },
  heroText: {
    gap: spacing.xs,
  },
  heroMutedText: {
    color: colors.darkMuted,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroStat: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.sm,
    flex: 1,
    gap: 2,
    padding: spacing.md,
  },
  groupSection: {
    gap: spacing.sm,
  },
  groupCard: {
    gap: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
  },
  dangerGroup: {
    borderColor: colors.dangerSoft,
  },
  settingsItem: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemValue: {
    flexShrink: 1,
    maxWidth: 132,
    textAlign: 'right',
  },
  modalButtons: {
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.78,
  },
});
