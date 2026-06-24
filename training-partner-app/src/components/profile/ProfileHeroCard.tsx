import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Tag } from '@/components/ui';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { AuthUser } from '@/services/auth/authTypes';
import { colors, radius, shadows, spacing } from '@/theme';

function formatRole(role?: GroupMember['role']) {
  if (role === 'owner') return '组长';
  if (role === 'coach') return '教练';
  if (role === 'guest') return '访客';
  return '成员';
}

type ProfileHeroCardProps = {
  currentMember: GroupMember | null;
  group: Group | null;
  isLoggedIn: boolean;
  onContinue: () => void;
  onLogin: () => void;
  onPress: () => void;
  user: AuthUser | null;
};

export function ProfileHeroCard({
  currentMember,
  group,
  isLoggedIn,
  onContinue,
  onLogin,
  onPress,
  user,
}: ProfileHeroCardProps) {
  if (!isLoggedIn || !user) {
    return (
      <View style={styles.card}>
        <View style={styles.loggedOutContent}>
          <View style={styles.avatarGhost}>
            <Ionicons color={colors.surface} name="person-outline" size={34} />
          </View>
          <View style={styles.loggedOutText}>
            <AppText tone="inverse" variant="title" weight="900">
              登录后开始记录训练
            </AppText>
            <AppText style={styles.heroMuted} variant="bodySmall">
              登录后可以保存你的训练身份、小组、计划和训练记录。换手机或重装后，可以通过账号恢复数据。
            </AppText>
          </View>
          <View style={styles.heroActions}>
            <AppButton onPress={onLogin} size="sm">
              登录 / 注册
            </AppButton>
            <AppButton onPress={onContinue} size="sm" variant="dark">
              继续浏览
            </AppButton>
          </View>
        </View>
      </View>
    );
  }

  const memberName = currentMember?.displayName ?? '还没有训练身份';
  const groupName = group?.name ?? '还没有训练小组';
  const roleLabel = currentMember ? formatRole(currentMember.role) : '待创建';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <AppText tone="inverse" variant="title" weight="900">
              {user.displayName.slice(0, 1)}
            </AppText>
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons color={colors.textStrong} name="camera" size={17} />
          </View>
        </View>

        <View style={styles.identityBlock}>
          <View style={styles.nameRow}>
            <AppText tone="inverse" variant="title" weight="900">
              {user.displayName}
            </AppText>
            <Tag label={roleLabel} tone="danger" />
          </View>
          <AppText style={styles.heroMuted} variant="bodySmall">
            练刻 ID: {user.liftmarkId}
          </AppText>
          <View style={styles.loginRow}>
            <Ionicons color={colors.success} name="checkmark-circle" size={16} />
            <AppText tone="success" variant="caption" weight="800">
              已登录
            </AppText>
          </View>
        </View>

        <Ionicons color="rgba(255,255,255,0.78)" name="chevron-forward" size={24} />
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <HeroField icon="person-outline" label="当前成员" value={memberName} />
        <View style={styles.statDivider} />
        <HeroField icon="people-outline" label="所在小组" value={groupName} />
        <View style={styles.statDivider} />
        <HeroField icon="ribbon-outline" label="训练角色" value={roleLabel} />
      </View>
    </Pressable>
  );
}

function HeroField({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.heroField}>
      <View style={styles.fieldTitle}>
        <Ionicons color="rgba(255,255,255,0.66)" name={icon} size={20} />
        <AppText style={styles.heroLabel} variant="caption">
          {label}
        </AppText>
      </View>
      <AppText numberOfLines={1} tone="inverse" variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  avatarGhost: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  avatarWrap: {
    position: 'relative',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.dark,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: -2,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    width: 30,
  },
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    gap: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
    ...shadows.hero,
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    height: 1,
  },
  fieldTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroField: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.62)',
  },
  heroMuted: {
    color: 'rgba(255,255,255,0.72)',
  },
  identityBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  loggedOutContent: {
    gap: spacing.md,
  },
  loggedOutText: {
    gap: spacing.xs,
  },
  loginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  statDivider: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    height: 44,
    width: 1,
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
