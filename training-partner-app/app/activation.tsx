import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Screen, SettingsRow, Tag } from '@/components/ui';
import { redeemActivationCode } from '@/services/membershipService';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ActivationRoute() {
  const { isLoggedIn, user } = useAuthStore();
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const redeem = async () => {
    setIsSaving(true);
    try {
      const result = await redeemActivationCode(code);
      if (!result.ok) {
        setNotice({ title: '兑换失败', message: result.message });
        return;
      }
      setNotice({ title: '兑换成功', message: '会员权益已同步到账户。' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="激活码兑换" subtitle="兑换会员权益、激活码和购买记录。">
      <AppCard style={styles.card} tone="dark">
        <Tag label={isLoggedIn ? '已登录' : '需登录'} tone="dark" />
        <AppText tone="inverse" variant="title" weight="900">
          练刻 LiftMark 激活码
        </AppText>
        <AppText style={styles.inverseMuted} variant="bodySmall">
          激活码会兑换到账户权益中。App 不保存阿里云密钥，也不直接访问短信或支付服务。
        </AppText>
      </AppCard>

      {!isLoggedIn ? (
        <AppCard style={styles.card}>
          <AppText variant="subtitle" weight="900">
            请先登录
          </AppText>
          <AppText tone="muted" variant="bodySmall">
            登录后才能将激活码绑定到你的账号。未登录仍可继续使用本机训练功能。
          </AppText>
          <AppButton onPress={() => router.push('/account/login' as never)}>登录 / 注册</AppButton>
        </AppCard>
      ) : (
        <>
          <AppCard style={styles.card}>
            <SettingsRow label="当前账号" value={user?.phone ?? user?.displayName ?? '-'} />
            <View style={styles.inputBox}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setCode}
                placeholder="请输入激活码"
                placeholderTextColor={colors.textSubtle}
                style={styles.input}
                value={code}
              />
            </View>
            <AppButton disabled={isSaving || !code.trim()} onPress={() => void redeem()} size="lg">
              {isSaving ? '兑换中...' : '兑换激活码'}
            </AppButton>
          </AppCard>

          <AppCard style={styles.card} tone="brand">
            <AppText variant="bodySmall" weight="900">
              激活码入口已迁移到会员与激活
            </AppText>
            <AppText tone="muted" variant="caption">
              当前版本不再显示本地试用状态或开发期测试码。权益以后端会员记录为准。
            </AppText>
          </AppCard>
        </>
      )}

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
  card: {
    gap: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 42,
  },
  inputBox: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inverseMuted: {
    color: colors.darkMuted,
  },
});

