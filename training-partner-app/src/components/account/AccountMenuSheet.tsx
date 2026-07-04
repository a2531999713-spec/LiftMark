import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

import { AccountMenuRow } from './AccountMenuRow';
import { ProfileSummaryCard } from './ProfileSummaryCard';

type AccountMenuSheetProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  displayName: string;
  liftmarkId?: string;
  membershipLabel: string;
  onAboutPress: () => void;
  onBackupPress: () => void;
  onClose: () => void;
  onFeedbackPress: () => void;
  onLogoutPress: () => void;
  onManageGroupPress: () => void;
  onMembershipPress: () => void;
  onPlanPress: () => void;
  onPreferencesPress: () => void;
  onPrivacyPress: () => void;
  onProfilePress: () => void;
  onSwitchGroupPress: () => void;
  onSyncPress: () => void;
  onTermsPress: () => void;
  phoneMasked?: string;
  syncLabel: string;
  visible: boolean;
};

export function AccountMenuSheet({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  displayName,
  liftmarkId,
  membershipLabel,
  onAboutPress,
  onBackupPress,
  onClose,
  onFeedbackPress,
  onLogoutPress,
  onManageGroupPress,
  onMembershipPress,
  onPlanPress,
  onPreferencesPress,
  onPrivacyPress,
  onProfilePress,
  onSwitchGroupPress,
  onSyncPress,
  onTermsPress,
  phoneMasked,
  syncLabel,
  visible,
}: AccountMenuSheetProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.safePanel}>
          <View style={styles.panel}>
            <View style={styles.grabber} />
            <ProfileSummaryCard
              avatarLocalUri={avatarLocalUri}
              avatarThumbUrl={avatarThumbUrl}
              avatarUrl={avatarUrl}
              compact
              displayName={displayName}
              liftmarkId={liftmarkId}
              membershipLabel={membershipLabel}
              onPress={onProfilePress}
              phoneMasked={phoneMasked}
              syncLabel={syncLabel}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <AccountMenuRow icon="person-circle-outline" label="个人资料" onPress={onProfilePress} />
                <AccountMenuRow
                  icon="swap-horizontal-outline"
                  label="切换小组"
                  onPress={onSwitchGroupPress}
                />
                <AccountMenuRow
                  icon="people-outline"
                  label="管理小组与成员"
                  onPress={onManageGroupPress}
                />
                <AccountMenuRow icon="clipboard-outline" label="我的计划" onPress={onPlanPress} />
              </View>

              <View style={styles.section}>
                <AccountMenuRow icon="cloud-outline" label="云同步" onPress={onSyncPress} trailing={syncLabel} />
                <AccountMenuRow icon="server-outline" label="数据备份" onPress={onBackupPress} />
                <AccountMenuRow icon="barbell-outline" label="训练偏好" onPress={onPreferencesPress} />
                <AccountMenuRow
                  icon="diamond-outline"
                  label="会员 / 激活码"
                  onPress={onMembershipPress}
                  trailing={membershipLabel}
                />
              </View>

              <View style={styles.section}>
                <AccountMenuRow icon="chatbubble-ellipses-outline" label="设置与反馈" onPress={onFeedbackPress} />
                <AccountMenuRow icon="shield-checkmark-outline" label="隐私政策" onPress={onPrivacyPress} />
                <AccountMenuRow icon="document-text-outline" label="用户协议" onPress={onTermsPress} />
                <AccountMenuRow icon="information-circle-outline" label="关于练刻" onPress={onAboutPress} />
              </View>

              <View style={styles.logoutBlock}>
                <AccountMenuRow danger icon="log-out-outline" label="退出登录" onPress={onLogoutPress} />
                <AppText style={styles.logoutHint} tone="subtle" variant="caption">
                  退出账号不会删除本机训练记录。
                </AppText>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 4,
    marginBottom: spacing.md,
    width: 42,
  },
  logoutBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoutHint: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    gap: spacing.md,
    maxHeight: '82%',
    padding: spacing.lg,
    ...shadows.raised,
  },
  safePanel: {
    width: '100%',
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
