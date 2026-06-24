import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { getMembership, type Membership } from '@/services/membershipService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfileMembershipRoute() {
  const { isLoggedIn } = useAuthStore();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMembership(await getMembership());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '会员状态加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const showDeveloping = (title: string) => setNotice({ title, message: '该功能正在开发中，后续版本开放。' });

  return (
    <Screen title="会员与激活" subtitle="权益、激活码、购买记录。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="会员状态加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <View>
                <AppText variant="title" weight="900">
                  当前会员状态
                </AppText>
                <AppText tone="muted" variant="bodySmall">
                  会员和激活码统一放在这里
                </AppText>
              </View>
              <Tag
                label={membership?.type === 'pro' || membership?.type === 'lifetime' ? '已激活权益' : '免费版'}
                tone={membership?.type === 'pro' || membership?.type === 'lifetime' ? 'success' : 'neutral'}
              />
            </View>
            <SettingsRow label="会员类型" value={membership?.type === 'lifetime' ? '永久会员' : membership?.type === 'pro' ? 'Pro' : '免费版'} />
            <SettingsRow label="到期时间" value={membership?.isLifetime ? '永久' : membership?.expiresAt ? String(membership.expiresAt).slice(0, 10) : '无'} />
            <SettingsRow label="是否永久会员" value={membership?.isLifetime ? '是' : '否'} />
            <SettingsRow label="可激活 Pro 小组数量" value={`${membership?.proGroupLimit ?? 0}`} />
            <SettingsRow label="已激活 Pro 小组数量" value={`${membership?.activatedProGroupCount ?? 0}`} />
          </AppCard>

          <AppCard style={styles.card} tone="soft">
            <AppText variant="bodySmall" weight="900">
              免费版已支持真实训练
            </AppText>
            <AppText tone="muted" variant="caption">
              你可以和 1 个搭子一起训练，保存基础训练记录，并体验多人训练的核心价值。
            </AppText>
          </AppCard>

          <AppCard style={styles.card} tone="brand">
            <AppText variant="bodySmall" weight="900">
              开通 Pro，解锁完整训练小组
            </AppText>
            <AppText tone="muted" variant="caption">
              支持最多 4 人一起练、更多训练计划、完整计划编辑器、高级历史趋势、自动进阶建议、完整云同步和 2 个 Pro 小组。
            </AppText>
          </AppCard>

          <View style={styles.actions}>
            <AppButton onPress={() => router.push('/activation' as never)}>激活码兑换</AppButton>
            {!isLoggedIn ? (
              <AppButton onPress={() => router.push('/account/login' as never)} variant="secondary">
                登录 / 注册
              </AppButton>
            ) : null}
            <AppButton onPress={() => showDeveloping('购买入口')} variant="secondary">
              购买入口
            </AppButton>
            <AppButton onPress={() => showDeveloping('恢复权益 / 同步权益')} variant="secondary">
              恢复权益 / 同步权益
            </AppButton>
          </View>
        </>
      ) : null}

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

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
