import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sync as runSync } from '@/sync/syncOrchestrator';
import { countPendingSyncItems, enqueueSyncCandidate } from '@/sync/syncQueue';

import { Avatar } from '@/components/avatar';
import { AppModalSheet, AppText, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type {
  DefaultRecordTarget,
  DefaultTrainingMode,
  EffortDisplay,
  WeightIncrement,
  WeightUnit,
} from '@/domain/preferences/user-preferences.types';
import type { AccountProfileCache, AvatarPickSource } from '@/services/avatar';
import { colors, radius, shadows, spacing, typography } from '@/theme';

import { AccountPanelHeader } from './AccountPanelHeader';
import { AccountPanelRow } from './AccountPanelRow';
import { type AccountGender, EditProfilePanel, type EditProfileDraft } from './EditProfilePanel';
import { TrainingGroupPanel } from './TrainingGroupPanel';

type AccountPanelMode =
  | 'main'
  | 'editProfile'
  | 'trainingGroup'
  | 'sync'
  | 'preferences'
  | 'membership'
  | 'backup';

export type AccountProfileUpdate = {
  age?: number;
  displayName: string;
  gender?: AccountGender;
};

type AccountPanelProps = {
  achievementSummary?: string;
  accountProfile?: AccountProfileCache | null;
  activePlanName?: string;
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  currentGroup?: Group | null;
  currentMemberId?: string;
  displayName: string;
  groups: Group[];
  liftmarkId?: string;
  latestWeightLabel?: string | null;
  membershipLabel: string;
  members: GroupMember[];
  onAboutPress: () => void;
  onAchievementsPress: () => void;
  onBodyMetricsPress: () => void;
  onAvatarPick: (source: AvatarPickSource) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
  onClose: () => void;
  onCreateGroupPress: () => void;
  onGroupSettingsPress: () => void;
  onLogoutPress: () => void;
  onManageMembersPress: () => void;
  onPrivacyPress: () => void;
  onSaveProfile: (input: AccountProfileUpdate) => Promise<void>;
  onSelectGroup: (groupId: string) => void;
  onTermsPress: () => void;
  phoneMasked?: string;
  syncLabel: string;
  visible: boolean;
};

function buildDraft(profile: AccountProfileCache | null | undefined, displayName: string): EditProfileDraft {
  return {
    ageText: typeof profile?.age === 'number' ? `${profile.age}` : '',
    displayName,
    gender: profile?.gender ?? 'unspecified',
  };
}

function normalizeAge(ageText: string) {
  if (!ageText.trim()) return undefined;
  const age = Number(ageText);
  return Number.isFinite(age) ? age : undefined;
}

function normalizeGender(gender: AccountGender) {
  return gender === 'unspecified' ? undefined : gender;
}

export function AccountPanel({
  achievementSummary,
  accountProfile,
  activePlanName,
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  currentGroup,
  displayName,
  groups,
  liftmarkId,
  latestWeightLabel,
  membershipLabel,
  members,
  onAboutPress,
  onAchievementsPress,
  onBodyMetricsPress,
  onAvatarPick,
  onAvatarRemove,
  onClose,
  onCreateGroupPress,
  onGroupSettingsPress,
  onLogoutPress,
  onManageMembersPress,
  onPrivacyPress,
  onSaveProfile,
  onSelectGroup,
  onTermsPress,
  phoneMasked,
  syncLabel,
  visible,
}: AccountPanelProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [mode, setMode] = useState<AccountPanelMode>('main');
  const [draft, setDraft] = useState<EditProfileDraft>(() => buildDraft(accountProfile, displayName));
  const [isSavingProfile, setSavingProfile] = useState(false);
  const [isAvatarWorking, setAvatarWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isFeedbackSheetOpen, setFeedbackSheetOpen] = useState(false);

  const initialDraft = useMemo(
    () => buildDraft(accountProfile, displayName),
    [accountProfile, displayName],
  );
  const profileDirty =
    draft.displayName.trim() !== initialDraft.displayName.trim() ||
    draft.ageText.trim() !== initialDraft.ageText.trim() ||
    draft.gender !== initialDraft.gender;

  const goMain = () => {
    if (mode === 'editProfile' && profileDirty) {
      Alert.alert('有未保存的修改', '要放弃本次修改吗？', [
        { text: '继续编辑', style: 'cancel' },
        {
          text: '放弃修改',
          style: 'destructive',
          onPress: () => {
            setDraft(initialDraft);
            setMode('main');
          },
        },
        {
          text: '保存',
          onPress: () => {
            void saveProfile().then((saved) => {
              if (saved) {
                setMode('main');
              }
            });
          },
        },
      ]);
      return;
    }
    setMode('main');
  };

  const requestClose = () => {
    if (mode !== 'main') {
      goMain();
      return;
    }
    onClose();
  };

  const saveProfile = async () => {
    const name = draft.displayName.trim();
    const age = normalizeAge(draft.ageText);
    if (name.length < 1) {
      Alert.alert('昵称不能为空', '请输入 1-16 个字的昵称。');
      return false;
    }
    if (name.length > 16) {
      Alert.alert('昵称过长', '昵称最多 16 个字。');
      return false;
    }
    if (draft.ageText.trim() && (!age || age < 6 || age > 100)) {
      Alert.alert('年龄不正确', '请输入 6-100 之间的年龄，或留空。');
      return false;
    }

    setSavingProfile(true);
    try {
      await onSaveProfile({
        age,
        displayName: name,
        gender: normalizeGender(draft.gender),
      });
      setFeedback('已保存');
      return true;
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试。');
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const pickAvatar = async (source: AvatarPickSource) => {
    setAvatarWorking(true);
    try {
      await onAvatarPick(source);
      setFeedback('头像已更新');
    } catch (error) {
      Alert.alert('头像未更新', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setAvatarWorking(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarWorking(true);
    try {
      await onAvatarRemove();
      setFeedback('头像已移除');
    } catch (error) {
      Alert.alert('头像未移除', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setAvatarWorking(false);
    }
  };

  const panelWidth = Math.min(width - spacing.lg * 2, 334);
  const panelMaxHeight = Math.min(height * 0.74, height - insets.top - insets.bottom - spacing.xxl);
  const panelTop = insets.top + 76;

  return (
    <>
    <Modal animationType="fade" onRequestClose={requestClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={requestClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.panel,
            {
              maxHeight: panelMaxHeight,
              right: spacing.lg,
              top: panelTop,
              width: panelWidth,
            },
          ]}
        >
          {mode === 'main' ? (
            <MainPanel
              avatarLocalUri={avatarLocalUri}
              avatarThumbUrl={avatarThumbUrl}
              avatarUrl={avatarUrl}
              currentGroup={currentGroup}
              displayName={displayName}
              liftmarkId={liftmarkId}
              latestWeightLabel={latestWeightLabel}
              membershipLabel={membershipLabel}
              memberCount={members.length}
              onAboutPress={onAboutPress}
              onAchievementsPress={onAchievementsPress}
              achievementSummary={achievementSummary}
              onBodyMetricsPress={onBodyMetricsPress}
              onBackupPress={() => setMode('backup')}
              onEditPress={() => {
                setDraft(initialDraft);
                setMode('editProfile');
              }}
              onFeedbackPress={() => setFeedbackSheetOpen(true)}
              onLogoutPress={onLogoutPress}
              onMembershipPress={() => setMode('membership')}
              onPreferencesPress={() => setMode('preferences')}
              onPrivacyPress={onPrivacyPress}
              onSyncPress={() => setMode('sync')}
              onTermsPress={onTermsPress}
              onTrainingGroupPress={() => setMode('trainingGroup')}
              phoneMasked={phoneMasked}
              syncLabel={syncLabel}
            />
          ) : null}

          {mode === 'editProfile' ? (
            <PanelScroll>
              <AccountPanelHeader
                canSave={profileDirty}
                isSaving={isSavingProfile}
                onBack={goMain}
                onSave={() => void saveProfile()}
                subtitle="头像、昵称与基础资料"
                title="编辑个人信息"
              />
              <EditProfilePanel
                avatarLocalUri={avatarLocalUri}
                avatarThumbUrl={avatarThumbUrl}
                avatarUrl={avatarUrl}
                draft={draft}
                isAvatarWorking={isAvatarWorking}
                liftmarkId={liftmarkId}
                membershipLabel={membershipLabel}
                onAvatarPick={pickAvatar}
                onAvatarRemove={removeAvatar}
                onDraftChange={setDraft}
                onMembershipPress={() => setMode('membership')}
                onSyncPress={() => setMode('sync')}
                phoneMasked={phoneMasked}
                syncLabel={syncLabel}
              />
            </PanelScroll>
          ) : null}

          {mode === 'trainingGroup' ? (
            <PanelScroll>
              <AccountPanelHeader onBack={goMain} subtitle="切换和管理都在这里" title="训练小组" />
              <TrainingGroupPanel
                activePlanName={activePlanName}
                currentGroup={currentGroup}
                groups={groups}
                members={members}
                onCreateGroupPress={onCreateGroupPress}
                onGroupSettingsPress={onGroupSettingsPress}
                onManageMembersPress={onManageMembersPress}
                onSelectGroup={onSelectGroup}
              />
            </PanelScroll>
          ) : null}

          {mode === 'sync' ? <SyncPanel onBack={goMain} syncLabel={syncLabel} /> : null}
          {mode === 'backup' ? <BackupPanel onBack={goMain} /> : null}
          {mode === 'preferences' ? <PreferencesPanel onBack={goMain} /> : null}
          {mode === 'membership' ? (
            <MembershipPanel membershipLabel={membershipLabel} onBack={goMain} />
          ) : null}

          {feedback ? (
            <View style={styles.feedback}>
              <Ionicons color={colors.success} name="checkmark-circle" size={15} />
              <AppText tone="success" variant="caption" weight="900">
                {feedback}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>

      <FeedbackSheet visible={isFeedbackSheetOpen} onClose={() => setFeedbackSheetOpen(false)} />
    </>
  );
}

type MainPanelProps = {
  achievementSummary?: string;
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  currentGroup?: Group | null;
  displayName: string;
  liftmarkId?: string;
  latestWeightLabel?: string | null;
  membershipLabel: string;
  memberCount: number;
  onAboutPress: () => void;
  onAchievementsPress: () => void;
  onBodyMetricsPress: () => void;
  onBackupPress: () => void;
  onEditPress: () => void;
  onFeedbackPress: () => void;
  onLogoutPress: () => void;
  onMembershipPress: () => void;
  onPreferencesPress: () => void;
  onPrivacyPress: () => void;
  onSyncPress: () => void;
  onTermsPress: () => void;
  onTrainingGroupPress: () => void;
  phoneMasked?: string;
  syncLabel: string;
};

function MainPanel({
  achievementSummary,
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  currentGroup,
  displayName,
  liftmarkId,
  latestWeightLabel,
  membershipLabel,
  memberCount,
  onAboutPress,
  onAchievementsPress,
  onBodyMetricsPress,
  onBackupPress,
  onEditPress,
  onFeedbackPress,
  onLogoutPress,
  onMembershipPress,
  onPreferencesPress,
  onPrivacyPress,
  onSyncPress,
  onTermsPress,
  onTrainingGroupPress,
  phoneMasked,
  syncLabel,
}: MainPanelProps) {
  return (
    <PanelScroll>
      <Pressable
        accessibilityRole="button"
        onPress={onEditPress}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <Avatar
          avatarLocalUri={avatarLocalUri}
          avatarThumbUrl={avatarThumbUrl}
          avatarUrl={avatarUrl}
          name={displayName}
          size={44}
        />
        <View style={styles.summaryText}>
          <AppText numberOfLines={1} variant="subtitle" weight="900">
            {displayName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {phoneMasked ?? '手机号未绑定'}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {liftmarkId ? `LiftMark ID: ${liftmarkId}` : 'LiftMark ID 未生成'}
          </AppText>
          <View style={styles.summaryMeta}>
            <Tag label={syncLabel} tone="success" />
            <Tag label={membershipLabel} tone="brand" />
          </View>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </Pressable>

      <View style={styles.section}>
        <AccountPanelRow
          description={`${currentGroup?.name ?? '默认训练小组'} · ${memberCount} 人`}
          icon="people-outline"
          label="训练小组"
          onPress={onTrainingGroupPress}
        />
        <Divider />
        <AccountPanelRow
          description="查看训练连续性和阶段进度"
          icon="ribbon-outline"
          label="成就与里程碑"
          onPress={onAchievementsPress}
          trailing={achievementSummary}
        />
        <Divider />
        <AccountPanelRow icon="cloud-outline" label="云同步" onPress={onSyncPress} trailing={syncLabel} />
        <Divider />
        <AccountPanelRow icon="server-outline" label="数据备份" onPress={onBackupPress} trailing="本机保存" />
        <Divider />
        <AccountPanelRow icon="diamond-outline" label="会员 / 激活码" onPress={onMembershipPress} trailing={membershipLabel} />
        <Divider />
        <AccountPanelRow icon="barbell-outline" label="训练偏好" onPress={onPreferencesPress} />
        <AccountPanelRow description="记录体重、体脂和围度" icon="scale-outline" label="身体数据" onPress={onBodyMetricsPress} trailing={latestWeightLabel ?? '去记录'} />
      </View>

      <View style={styles.section}>
        <AccountPanelRow icon="chatbubble-ellipses-outline" label="反馈与建议" onPress={onFeedbackPress} />
        <Divider />
        <AccountPanelRow icon="shield-checkmark-outline" label="隐私政策" onPress={onPrivacyPress} />
        <Divider />
        <AccountPanelRow icon="document-text-outline" label="用户协议" onPress={onTermsPress} />
        <Divider />
        <AccountPanelRow icon="information-circle-outline" label="关于练刻" onPress={onAboutPress} />
      </View>

      <View style={styles.section}>
        <AccountPanelRow danger icon="log-out-outline" label="退出登录" onPress={onLogoutPress} />
      </View>
    </PanelScroll>
  );
}

function SyncPanel({ onBack, syncLabel }: { onBack: () => void; syncLabel: string }) {
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await countPendingSyncItems();
      setPendingCount(count);
    } catch {
      setPendingCount(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshPendingCount();
    });
  }, [refreshPendingCount]);

  const formatPendingLabel = () => {
    if (pendingCount === null) return '读取中';
    if (pendingCount === 0) return '0 条';
    return `${pendingCount} 条`;
  };

  const handleSync = async () => {
    Alert.alert('开始同步', '正在从云端拉取数据并推送本地变更...');
    try {
      const result = await runSync({ fullPull: true });
      const now = new Date().toISOString();
      setLastSyncedAt(now);
      void refreshPendingCount();
      if (result.ok) {
        Alert.alert('同步完成', result.message || '同步成功完成。');
      } else {
        Alert.alert('同步失败', result.message || '未知错误');
      }
    } catch (error) {
      Alert.alert('同步异常', error instanceof Error ? error.message : String(error));
    }
  };

  const formatLastSynced = () => {
    if (!lastSyncedAt) return '尚未同步';
    const date = new Date(lastSyncedAt);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <PanelScroll>
      <AccountPanelHeader onBack={onBack} subtitle={syncLabel} title="云同步" />
      <StatusCard icon="cloud-outline" title="当前状态" value={syncLabel}>
        <InfoLine label="最近同步" value={formatLastSynced()} />
        <InfoLine label="待同步数据" value={formatPendingLabel()} />
        <View style={styles.settingLine}>
          <View>
            <AppText variant="bodySmall" weight="900">
              云同步开关
            </AppText>
            <AppText tone="muted" variant="caption">
              开启后训练数据会优先进入同步队列
            </AppText>
          </View>
          <Switch
            onValueChange={setSyncEnabled}
            thumbColor={colors.surface}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            value={syncEnabled}
          />
        </View>
      </StatusCard>
      <ActionRow
        icon="sync-outline"
        label="立即同步"
        onPress={handleSync}
        value="点击同步"
      />
      <ActionRow
        icon="cloud-download-outline"
        label="从云端恢复"
        onPress={async () => {
          Alert.alert('开始恢复', '正在从云端全量拉取数据到本地...');
          try {
            const result = await runSync({ fullPull: true });
            const now = new Date().toISOString();
            setLastSyncedAt(now);
            void refreshPendingCount();
            if (result.ok) {
              Alert.alert('恢复完成', result.message || '已从云端拉取全部数据。请返回首页查看。');
            } else {
              Alert.alert('恢复失败', result.message || '未知错误');
            }
          } catch (error) {
            Alert.alert('恢复异常', error instanceof Error ? error.message : String(error));
          }
        }}
        value="点击恢复"
      />
      <DevelopmentNote text="当前同步面板直接展示状态与操作入口；未完成能力统一提示开发中，不跳空白中转页。" />
    </PanelScroll>
  );
}

function BackupPanel({ onBack }: { onBack: () => void }) {
  const showDevelopment = (title: string) => {
    Alert.alert(title, '数据备份能力正在接入。当前训练记录仍优先安全保存在本机数据库。');
  };

  return (
    <PanelScroll>
      <AccountPanelHeader onBack={onBack} subtitle="导出、恢复和备份记录" title="数据备份" />
      <StatusCard icon="server-outline" title="备份状态" value="本机保存">
        <InfoLine label="上次备份" value="尚未生成" />
        <InfoLine label="可导出范围" value="训练记录 / 计划 / 小组资料" />
      </StatusCard>
      <ActionRow icon="download-outline" label="导出训练记录" onPress={() => showDevelopment('导出训练记录')} value="开发中" />
      <ActionRow icon="document-outline" label="导出计划" onPress={() => showDevelopment('导出计划')} value="开发中" />
      <ActionRow icon="folder-open-outline" label="本地完整备份" onPress={() => showDevelopment('本地完整备份')} value="开发中" />
      <ActionRow icon="refresh-outline" label="从备份恢复" onPress={() => showDevelopment('从备份恢复')} value="需确认覆盖范围" />
      <DevelopmentNote text="恢复类操作正式上线前必须增加预览、冲突检查和二次确认。" />
    </PanelScroll>
  );
}

function PreferencesPanel({ onBack }: { onBack: () => void }) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [recordTarget, setRecordTarget] = useState<DefaultRecordTarget>('group_members');
  const [restTimer, setRestTimer] = useState(true);
  const [trainingMode, setTrainingMode] = useState<DefaultTrainingMode>('full');
  const [increment, setIncrement] = useState<WeightIncrement>('2.5kg');
  const [effortDisplay, setEffortDisplay] = useState<EffortDisplay>('none');
  const [isLoaded, setIsLoaded] = useState(false);

  // 加载已持久化的偏好
  useEffect(() => {
    void (async () => {
      try {
        await initializeLocalDatabase();
        const prefs = await repositories.userPreferencesRepository.getPreferences();
        setWeightUnit(prefs.weightUnit);
        setRecordTarget(prefs.defaultRecordTarget);
        setRestTimer(prefs.restTimerEnabled);
        setTrainingMode(prefs.defaultTrainingMode);
        setIncrement(prefs.weightIncrement);
        setEffortDisplay(prefs.effortDisplay);
      } catch {
        // 读取失败时保持默认值
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [repositories]);

  // 保存偏好到本地并加入同步队列
  const savePreferences = async (patch: Partial<{
    weightUnit: WeightUnit;
    recordTarget: DefaultRecordTarget;
    restTimer: boolean;
    trainingMode: DefaultTrainingMode;
    increment: WeightIncrement;
    effortDisplay: EffortDisplay;
  }>) => {
    const next = {
      weightUnit: patch.weightUnit ?? weightUnit,
      defaultRecordTarget: patch.recordTarget ?? recordTarget,
      restTimerEnabled: patch.restTimer ?? restTimer,
      defaultTrainingMode: patch.trainingMode ?? trainingMode,
      weightIncrement: patch.increment ?? increment,
      effortDisplay: patch.effortDisplay ?? effortDisplay,
    };
    try {
      const saved = await repositories.userPreferencesRepository.upsertPreferences(next);
      // 加入 settings 同步通道上云
      void enqueueSyncCandidate({
        entityType: 'settings',
        localId: saved.id,
        operation: 'update',
        payload: {
          type: 'user_preferences',
          weightUnit: saved.weightUnit,
          defaultRecordTarget: saved.defaultRecordTarget,
          restTimerEnabled: saved.restTimerEnabled,
          defaultTrainingMode: saved.defaultTrainingMode,
          weightIncrement: saved.weightIncrement,
          effortDisplay: saved.effortDisplay,
          updatedAt: saved.updatedAt,
        },
        status: 'pending_update',
        updatedAt: saved.updatedAt,
      }).catch(() => undefined);
    } catch {
      // 保存失败时静默，不影响 UI 切换
    }
  };

  const recordTargetLabel = recordTarget === 'group_members' ? '小组成员' : '仅我记录';
  const trainingModeLabel =
    trainingMode === 'full' ? '完整动作' : trainingMode === 'simplified' ? '精简辅助' : '只做主项';
  const effortLabel =
    effortDisplay === 'none' ? '不展示' : effortDisplay === 'rpe' ? '展示 RPE' : '展示 RIR';

  return (
    <PanelScroll>
      <AccountPanelHeader onBack={onBack} subtitle="训练现场默认行为" title="训练偏好" />
      <PreferenceRow
        label="重量单位"
        onPress={() => {
          const next: WeightUnit = weightUnit === 'kg' ? 'lb' : 'kg';
          setWeightUnit(next);
          void savePreferences({ weightUnit: next });
        }}
        value={weightUnit}
      />
      <PreferenceRow
        label="默认记录对象"
        onPress={() => {
          const next: DefaultRecordTarget = recordTarget === 'group_members' ? 'self_only' : 'group_members';
          setRecordTarget(next);
          void savePreferences({ recordTarget: next });
        }}
        value={recordTargetLabel}
      />
      <View style={styles.preferenceCard}>
        <View>
          <AppText variant="bodySmall" weight="900">
            休息计时
          </AppText>
          <AppText tone="muted" variant="caption">
            完成本组后自动进入休息状态
          </AppText>
        </View>
        <Switch
          onValueChange={(value) => {
            setRestTimer(value);
            void savePreferences({ restTimer: value });
          }}
          thumbColor={colors.surface}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          value={restTimer}
        />
      </View>
      <PreferenceRow
        label="默认训练模式"
        onPress={() => {
          const next = nextValue(trainingMode, ['full', 'simplified', 'main_only'] as DefaultTrainingMode[]);
          setTrainingMode(next);
          void savePreferences({ trainingMode: next });
        }}
        value={trainingModeLabel}
      />
      <PreferenceRow
        label="加重步进"
        onPress={() => {
          const next = nextValue(increment, ['2.5kg', '1.25kg', '5kg'] as WeightIncrement[]);
          setIncrement(next);
          void savePreferences({ increment: next });
        }}
        value={increment}
      />
      <PreferenceRow
        label="RPE / RIR"
        onPress={() => {
          const next = nextValue(effortDisplay, ['none', 'rpe', 'rir'] as EffortDisplay[]);
          setEffortDisplay(next);
          void savePreferences({ effortDisplay: next });
        }}
        value={effortLabel}
      />
      {isLoaded ? (
        <DevelopmentNote text="偏好已保存到本机并加入云同步队列，登录后会自动上传服务器。" />
      ) : null}
    </PanelScroll>
  );
}

function MembershipPanel({
  membershipLabel,
  onBack,
}: {
  membershipLabel: string;
  onBack: () => void;
}) {
  const [activationCode, setActivationCode] = useState('');

  const redeem = () => {
    if (!activationCode.trim()) {
      Alert.alert('请输入激活码', '激活码为空时无法兑换。');
      return;
    }
    Alert.alert('激活码兑换开发中', '当前版本仅展示会员状态，正式兑换会接入账号权益校验。');
  };

  return (
    <PanelScroll>
      <AccountPanelHeader onBack={onBack} subtitle={membershipLabel} title="会员 / 激活码" />
      <StatusCard icon="diamond-outline" title="当前权益" value={membershipLabel}>
        <InfoLine label="训练记录" value="可用" />
        <InfoLine label="高级分析" value="按会员状态开放" />
        <InfoLine label="云同步" value="接入中" />
      </StatusCard>
      <View style={styles.inputCard}>
        <AppText variant="bodySmall" weight="900">
          激活码
        </AppText>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setActivationCode}
          placeholder="输入激活码"
          placeholderTextColor={colors.textSubtle}
          style={styles.textInput}
          value={activationCode}
        />
        <Pressable accessibilityRole="button" onPress={redeem} style={styles.primaryButton}>
          <AppText tone="inverse" variant="caption" weight="900">
            兑换
          </AppText>
        </Pressable>
      </View>
      <DevelopmentNote text="价格、购买和续费能力未完成前不在客户端承诺；这里只保留状态、权益和激活码入口。" />
    </PanelScroll>
  );
}

function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [feedbackType, setFeedbackType] = useState<'feature' | 'issue'>('feature');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isFeature = feedbackType === 'feature';

  const submit = () => {
    if (!content.trim()) {
      Alert.alert(isFeature ? '请写下功能建议' : '请描述遇到的问题', '内容为空时无法提交。');
      return;
    }
    setSubmitted(true);
    Alert.alert('已保存到本机草稿', '联网提交和工单跟踪仍在开发中，当前不会丢失你输入的内容。');
  };

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="告诉我们你想要的训练能力，或描述遇到的问题"
      title="反馈与建议"
      visible={visible}
    >
      <View style={styles.feedbackTypeRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFeedbackType('feature')}
          style={[styles.feedbackTypeChip, isFeature && styles.feedbackTypeChipActive]}
        >
          <Ionicons name="bulb-outline" size={16} color={isFeature ? colors.surface : colors.primary} />
          <AppText tone={isFeature ? 'inverse' : 'muted'} variant="caption" weight="900">
            功能建议
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFeedbackType('issue')}
          style={[styles.feedbackTypeChip, !isFeature && styles.feedbackTypeChipActive]}
        >
          <Ionicons name="bug-outline" size={16} color={!isFeature ? colors.surface : colors.primary} />
          <AppText tone={!isFeature ? 'inverse' : 'muted'} variant="caption" weight="900">
            问题反馈
          </AppText>
        </Pressable>
      </View>

      <View style={styles.inputCard}>
        <AppText variant="bodySmall" weight="900">
          {isFeature ? '建议内容' : '问题描述'}
        </AppText>
        <TextInput
          multiline
          onChangeText={setContent}
          placeholder={isFeature ? '例如：希望按动作自动生成热身组...' : '例如：首页偶尔提示加载失败，重试后恢复...'}
          placeholderTextColor={colors.textSubtle}
          style={[styles.textInput, styles.multilineInput]}
          textAlignVertical="top"
          value={content}
        />
        <AppText variant="bodySmall" weight="900">
          联系方式（选填）
        </AppText>
        <TextInput
          onChangeText={setContact}
          placeholder="手机号 / 邮箱 / 备注"
          placeholderTextColor={colors.textSubtle}
          style={styles.textInput}
          value={contact}
        />
        <Pressable accessibilityRole="button" onPress={submit} style={styles.primaryButton}>
          <AppText tone="inverse" variant="caption" weight="900">
            {submitted ? '更新草稿' : '提交'}
          </AppText>
        </Pressable>
      </View>
      <DevelopmentNote text="提交服务接入前，面板会明确提示本机草稿状态，不做无响应按钮。" />
    </AppModalSheet>
  );
}

function StatusCard({
  children,
  icon,
  title,
  value,
}: {
  children?: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <View style={styles.statusIcon}>
          <Ionicons color={colors.primary} name={icon} size={20} />
        </View>
        <View style={styles.statusText}>
          <AppText variant="bodySmall" weight="900">
            {title}
          </AppText>
          <AppText tone="muted" variant="caption">
            {value}
          </AppText>
        </View>
      </View>
      {children}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="caption" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function ActionRow({
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
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <AppText style={styles.actionLabel} variant="bodySmall" weight="900">
        {label}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="caption" weight="800">
        {value}
      </AppText>
      <Ionicons color={colors.textSubtle} name="chevron-forward" size={17} />
    </Pressable>
  );
}

function PreferenceRow({ label, onPress, value }: { label: string; onPress: () => void; value: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.preferenceCard, pressed && styles.pressed]}>
      <View>
        <AppText variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText tone="muted" variant="caption">
          点击切换
        </AppText>
      </View>
      <View style={styles.preferenceValue}>
        <AppText variant="caption" weight="900">
          {value}
        </AppText>
        <Ionicons color={colors.textSubtle} name="chevron-forward" size={17} />
      </View>
    </Pressable>
  );
}

function DevelopmentNote({ text }: { text: string }) {
  return (
    <View style={styles.devNote}>
      <Ionicons color={colors.warning} name="construct-outline" size={16} />
      <AppText style={styles.devNoteText} tone="muted" variant="caption">
        {text}
      </AppText>
    </View>
  );
}

function nextValue<T extends string>(current: T, values: T[]): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function Divider() {
  return <View style={styles.divider} />;
}

function PanelScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView bounces={false} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  actionLabel: {
    flex: 1,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
  },
  devNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  devNoteText: {
    flex: 1,
    lineHeight: 18,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 42,
  },
  feedback: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.sm,
  },
  feedbackTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  feedbackTypeChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedbackTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  infoLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.sm,
  },
  panel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.sm,
    position: 'absolute',
    ...shadows.raised,
  },
  preferenceCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  preferenceValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.82,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingLine: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  statusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  statusText: {
    flex: 1,
    minWidth: 0,
  },
  summary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 82,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  summaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  summaryText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
