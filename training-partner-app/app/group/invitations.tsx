import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { Screen, SecondaryPageHeader } from '@/components/ui';
import { AppButton, AppCard, AppText, EmptyState } from '@/components/ui';
import {
  createInvitation,
  disableInvitation,
  getInvitations,
  type Invitation,
} from '@/services/invitationService';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

export default function InvitationsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const effectiveGroupId = groupId ?? selectedGroupId;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!effectiveGroupId) return;
    setIsLoading(true);
    setError(null);
    try {
      const items = await getInvitations(effectiveGroupId);
      setInvitations(items);
    } catch {
      setError('加载邀请码失败。');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveGroupId]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleCreate = useCallback(async () => {
    if (!effectiveGroupId) return;
    setIsCreating(true);
    try {
      const invitation = await createInvitation(effectiveGroupId, { maxUses: 10 });
      if (invitation) {
        setInvitations((prev) => [invitation, ...prev]);
      } else {
        Alert.alert('创建失败', '请稍后重试。');
      }
    } catch {
      Alert.alert('创建失败', '请稍后重试。');
    } finally {
      setIsCreating(false);
    }
  }, [effectiveGroupId]);

  const handleShare = useCallback(async (code: string) => {
    try {
      await Share.share({
        message: `邀请你加入我的训练小组！\n邀请码：${code}\n\n打开练刻 App，输入邀请码即可加入。`,
        title: '练刻小组邀请',
      });
    } catch {
      // 用户取消分享
    }
  }, []);

  const handleDisable = useCallback(
    async (invitation: Invitation) => {
      if (!effectiveGroupId) return;
      Alert.alert('禁用邀请码', `确定要禁用邀请码 ${invitation.code} 吗？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '确定禁用',
          style: 'destructive',
          onPress: async () => {
            const success = await disableInvitation(effectiveGroupId, invitation.id);
            if (success) {
              setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
            } else {
              Alert.alert('操作失败', '请稍后重试。');
            }
          },
        },
      ]);
    },
    [effectiveGroupId]
  );

  const renderInvitation = (invitation: Invitation) => {
    const isExpired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date();
    const isMaxReached = invitation.useCount >= invitation.maxUses;

    return (
      <AppCard key={invitation.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="headline" weight="900" style={styles.code}>
            {invitation.code}
          </AppText>
          {isExpired ? (
            <View style={[styles.badge, styles.badgeExpired]}>
              <AppText variant="caption" weight="700" style={styles.badgeTextExpired}>
                已过期
              </AppText>
            </View>
          ) : isMaxReached ? (
            <View style={[styles.badge, styles.badgeMaxed]}>
              <AppText variant="caption" weight="700" style={styles.badgeTextMaxed}>
                已满
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardMeta}>
          <AppText variant="caption" tone="muted">
            使用次数：{invitation.useCount}/{invitation.maxUses}
          </AppText>
          {invitation.expiresAt ? (
            <AppText variant="caption" tone="muted">
              过期时间：{new Date(invitation.expiresAt).toLocaleDateString('zh-CN')}
            </AppText>
          ) : (
            <AppText variant="caption" tone="muted">
              永不过期
            </AppText>
          )}
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => void handleShare(invitation.code)}
          >
            <Ionicons color={colors.primary} name="share-outline" size={18} />
            <AppText variant="caption" weight="700" style={styles.actionText}>
              分享
            </AppText>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => void handleDisable(invitation)}
          >
            <Ionicons color={colors.danger} name="close-circle-outline" size={18} />
            <AppText variant="caption" weight="700" style={[styles.actionText, styles.dangerText]}>
              禁用
            </AppText>
          </Pressable>
        </View>
      </AppCard>
    );
  };

  return (
    <Screen>
      <SecondaryPageHeader
        caption="小组管理"
        icon="people-outline"
        subtitle="生成邀请码，让朋友加入你的训练小组。"
        title="邀请成员"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="加载失败" description={error} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {invitations.length === 0 ? (
            <EmptyState
              description="创建邀请码后分享给朋友，输入即可加入小组。"
              title="暂无邀请码"
            />
          ) : (
            invitations.map(renderInvitation)
          )}

          <AppButton
            disabled={isCreating}
            onPress={() => void handleCreate()}
            style={styles.createButton}
          >
            {isCreating ? '创建中...' : '生成新邀请码'}
          </AppButton>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  code: {
    letterSpacing: 2,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeExpired: {
    backgroundColor: colors.warningSoft,
  },
  badgeTextExpired: {
    color: colors.warning,
  },
  badgeMaxed: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeTextMaxed: {
    color: colors.darkMuted,
  },
  cardMeta: {
    gap: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionText: {
    color: colors.primary,
  },
  dangerText: {
    color: colors.danger,
  },
  createButton: {
    marginTop: spacing.md,
  },
});
