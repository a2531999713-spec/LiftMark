import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo, useState, type ReactNode } from 'react';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { AccountProfileCache, AvatarPickSource } from '@/services/avatar';
import { colors, radius, shadows, spacing } from '@/theme';

import { AccountPanelHeader } from './AccountPanelHeader';
import { AccountPanelRow } from './AccountPanelRow';
import { type AccountGender, EditProfilePanel, type EditProfileDraft } from './EditProfilePanel';
import { TrainingGroupPanel } from './TrainingGroupPanel';

type AccountPanelMode = 'main' | 'editProfile' | 'trainingGroup' | 'sync' | 'preferences' | 'membership' | 'backup';

export type AccountProfileUpdate = {
  age?: number;
  displayName: string;
  gender?: AccountGender;
};

type AccountPanelProps = {
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
  membershipLabel: string;
  members: GroupMember[];
  onAboutPress: () => void;
  onAvatarPick: (source: AvatarPickSource) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
  onBackupPress: () => void;
  onClose: () => void;
  onCreateGroupPress: () => void;
  onFeedbackPress: () => void;
  onGroupSettingsPress: () => void;
  onLogoutPress: () => void;
  onManageMembersPress: () => void;
  onMembershipPress: () => void;
  onPlanPress: () => void;
  onPreferencesPress: () => void;
  onPrivacyPress: () => void;
  onSaveProfile: (input: AccountProfileUpdate) => Promise<void>;
  onSelectGroup: (groupId: string) => void;
  onSyncPress: () => void;
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
  accountProfile,
  activePlanName,
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  currentGroup,
  displayName,
  groups,
  liftmarkId,
  membershipLabel,
  members,
  onAboutPress,
  onAvatarPick,
  onAvatarRemove,
  onBackupPress,
  onClose,
  onCreateGroupPress,
  onFeedbackPress,
  onGroupSettingsPress,
  onLogoutPress,
  onManageMembersPress,
  onMembershipPress,
  onPlanPress,
  onPreferencesPress,
  onPrivacyPress,
  onSaveProfile,
  onSelectGroup,
  onSyncPress,
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
      return;
    }
    if (name.length > 16) {
      Alert.alert('昵称过长', '昵称最多 16 个字。');
      return;
    }
    if (draft.ageText.trim() && (!age || age < 6 || age > 100)) {
      Alert.alert('年龄不正确', '请输入 6-100 之间的年龄，或留空。');
      return;
    }

    setSavingProfile(true);
    try {
      await onSaveProfile({
        age,
        displayName: name,
        gender: normalizeGender(draft.gender),
      });
      setFeedback('已保存');
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试。');
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

  const panelWidth = Math.min(width * 0.88, 360);
  const panelMaxHeight = height * 0.76;
  const panelTop = insets.top + 54;

  return (
    <Modal animationType="fade" onRequestClose={requestClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={requestClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.panel,
            {
              maxHeight: panelMaxHeight,
              right: spacing.md,
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
              membershipLabel={membershipLabel}
              memberCount={members.length}
              onAboutPress={onAboutPress}
              onBackupPress={() => setMode('backup')}
              onEditPress={() => {
                setDraft(initialDraft);
                setMode('editProfile');
              }}
              onFeedbackPress={onFeedbackPress}
              onLogoutPress={onLogoutPress}
              onMembershipPress={() => setMode('membership')}
              onPlanPress={onPlanPress}
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
                subtitle="头像、昵称、年龄和性别"
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

          {mode === 'sync' ? (
            <InlineInfoPanel
              actionLabel="查看同步详情"
              icon="cloud-outline"
              onAction={onSyncPress}
              onBack={goMain}
              subtitle={syncLabel}
              text="当前版本保留手动同步诊断入口，完整自动同步队列会继续接入。"
              title="云同步"
            />
          ) : null}

          {mode === 'backup' ? (
            <InlineInfoPanel
              actionLabel="打开备份页"
              icon="server-outline"
              onAction={onBackupPress}
              onBack={goMain}
              subtitle="本机保存"
              text="训练记录优先写入本机 SQLite。云端备份和恢复能力正在完善中。"
              title="数据备份"
            />
          ) : null}

          {mode === 'preferences' ? (
            <InlineInfoPanel
              actionLabel="打开训练偏好"
              icon="barbell-outline"
              onAction={onPreferencesPress}
              onBack={goMain}
              subtitle="单位、记录方式、休息计时"
              text="常用偏好可以在完整页面继续查看和调整。"
              title="训练偏好"
            />
          ) : null}

          {mode === 'membership' ? (
            <InlineInfoPanel
              actionLabel="打开会员 / 激活码"
              icon="diamond-outline"
              onAction={onMembershipPress}
              onBack={goMain}
              subtitle={membershipLabel}
              text="会员状态来自账号权益。购买、续费等能力未完成前不会在这里承诺。"
              title="会员 / 激活码"
            />
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
  );
}

type MainPanelProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  currentGroup?: Group | null;
  displayName: string;
  liftmarkId?: string;
  membershipLabel: string;
  memberCount: number;
  onAboutPress: () => void;
  onBackupPress: () => void;
  onEditPress: () => void;
  onFeedbackPress: () => void;
  onLogoutPress: () => void;
  onMembershipPress: () => void;
  onPlanPress: () => void;
  onPreferencesPress: () => void;
  onPrivacyPress: () => void;
  onSyncPress: () => void;
  onTermsPress: () => void;
  onTrainingGroupPress: () => void;
  phoneMasked?: string;
  syncLabel: string;
};

function MainPanel({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  currentGroup,
  displayName,
  liftmarkId,
  membershipLabel,
  memberCount,
  onAboutPress,
  onBackupPress,
  onEditPress,
  onFeedbackPress,
  onLogoutPress,
  onMembershipPress,
  onPlanPress,
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
      <Pressable accessibilityRole="button" onPress={onEditPress} style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
        <Avatar
          avatarLocalUri={avatarLocalUri}
          avatarThumbUrl={avatarThumbUrl}
          avatarUrl={avatarUrl}
          name={displayName}
          size={46}
        />
        <View style={styles.summaryText}>
          <AppText numberOfLines={1} variant="subtitle" weight="900">
            {displayName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {phoneMasked ?? liftmarkId ?? '账号资料未完善'}
          </AppText>
          <View style={styles.summaryMeta}>
            <AppText numberOfLines={1} tone="success" variant="caption" weight="800">
              {syncLabel}
            </AppText>
            <View style={styles.dot} />
            <AppText numberOfLines={1} tone="brand" variant="caption" weight="800">
              {membershipLabel}
            </AppText>
          </View>
        </View>
        <Ionicons color={colors.textMuted} name="create-outline" size={19} />
      </Pressable>

      <View style={styles.section}>
        <AccountPanelRow
          description={`${currentGroup?.name ?? '默认训练小组'} · ${memberCount} 人`}
          icon="people-outline"
          label="训练小组"
          onPress={onTrainingGroupPress}
        />
        <Divider />
        <AccountPanelRow icon="clipboard-outline" label="我的计划" onPress={onPlanPress} />
      </View>

      <View style={styles.section}>
        <AccountPanelRow icon="cloud-outline" label="云同步" onPress={onSyncPress} trailing={syncLabel} />
        <Divider />
        <AccountPanelRow icon="server-outline" label="数据备份" onPress={onBackupPress} trailing="本机保存" />
        <Divider />
        <AccountPanelRow icon="diamond-outline" label="会员 / 激活码" onPress={onMembershipPress} trailing={membershipLabel} />
      </View>

      <View style={styles.section}>
        <AccountPanelRow icon="barbell-outline" label="训练偏好" onPress={onPreferencesPress} />
      </View>

      <View style={styles.section}>
        <AccountPanelRow icon="chatbubble-ellipses-outline" label="设置与反馈" onPress={onFeedbackPress} />
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

function InlineInfoPanel({
  actionLabel,
  icon,
  onAction,
  onBack,
  subtitle,
  text,
  title,
}: {
  actionLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onAction: () => void;
  onBack: () => void;
  subtitle: string;
  text: string;
  title: string;
}) {
  return (
    <PanelScroll>
      <AccountPanelHeader onBack={onBack} subtitle={subtitle} title={title} />
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Ionicons color={colors.primary} name={icon} size={22} />
        </View>
        <AppText variant="bodySmall" weight="900">
          {subtitle}
        </AppText>
        <AppText tone="muted" variant="caption">
          {text}
        </AppText>
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.infoButton}>
          <AppText tone="inverse" variant="caption" weight="900">
            {actionLabel}
          </AppText>
        </Pressable>
      </View>
    </PanelScroll>
  );
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
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
  dot: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 3,
    width: 3,
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
  infoButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  panel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.md,
    position: 'absolute',
    ...shadows.raised,
  },
  pressed: {
    opacity: 0.82,
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
  summary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 78,
    padding: spacing.md,
  },
  summaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  summaryText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
