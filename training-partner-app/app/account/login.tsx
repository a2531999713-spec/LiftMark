import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Screen, Tag } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function LoginRoute() {
  const { isLoading, login, loginWithCode, register, sendCode } = useAuthStore();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [mode, setMode] = useState<'password' | 'code' | 'register'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');

  const showResult = (message: string | null, successTitle: string) => {
    if (message) {
      setNotice({ title: '账号请求失败', message });
      return;
    }
    setNotice({ title: successTitle, message: '账号状态已同步。' });
    router.replace('/(tabs)/settings' as never);
  };

  const requestCode = async () => {
    const message = await sendCode({
      phone,
      purpose: mode === 'register' ? 'register' : 'login',
    });
    setNotice({ title: '验证码', message: message ?? '验证码已发送，请查看短信。' });
  };

  const submit = async () => {
    if (mode === 'password') {
      showResult(await login({ identifier: phone, password }), '登录成功');
    } else if (mode === 'code') {
      showResult(await loginWithCode({ phone, code }), '登录成功');
    } else {
      showResult(await register({ identifier: phone, password, displayName: nickname || `练刻用户${phone.slice(-4)}` }), '注册成功');
    }
  };

  return (
    <Screen title="登录 / 注册" subtitle="账号体系预留入口，训练数据仍本地优先保存。">
      <AppCard style={styles.card} tone="dark">
        <Tag label="本地训练不受影响" tone="dark" />
        <AppText tone="inverse" variant="title" weight="900">
          登录后开始记录训练
        </AppText>
        <AppText style={styles.inverseMuted} variant="bodySmall">
          登录后可以保存你的训练身份、小组、计划和训练记录。换手机或重装后，可以通过账号恢复数据。
        </AppText>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.modeRow}>
          <ModeButton active={mode === 'password'} label="密码登录" onPress={() => setMode('password')} />
          <ModeButton active={mode === 'code'} label="验证码" onPress={() => setMode('code')} />
          <ModeButton active={mode === 'register'} label="注册" onPress={() => setMode('register')} />
        </View>

        <AppText tone="muted" variant="bodySmall">
          App 只调用练刻后端 API，不直接调用阿里云。服务器不可用时，未登录用户仍可继续本地训练。
        </AppText>

        {mode === 'register' ? (
          <TextInput
            onChangeText={setNickname}
            placeholder="昵称"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            value={nickname}
          />
        ) : null}

        <TextInput
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="手机号"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          value={phone}
        />

        {mode === 'code' ? (
          <View style={styles.codeRow}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setCode}
              placeholder="验证码"
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, styles.codeInput]}
              value={code}
            />
            <AppButton disabled={isLoading || !phone.trim()} onPress={() => void requestCode()} size="sm" variant="secondary">
              获取验证码
            </AppButton>
          </View>
        ) : (
          <TextInput
            onChangeText={setPassword}
            placeholder={mode === 'register' ? '设置密码，至少 6 位' : '密码'}
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />
        )}

        {mode === 'register' ? (
          <AppButton disabled={isLoading || !phone.trim() || password.length < 6} onPress={() => void submit()}>
            注册
          </AppButton>
        ) : (
          <AppButton disabled={isLoading || !phone.trim() || (mode === 'password' ? !password : !code)} onPress={() => void submit()}>
            登录
          </AppButton>
        )}

        <View style={styles.actions}>
          <AppButton onPress={() => router.back()} variant="secondary">
            继续浏览
          </AppButton>
        </View>
      </AppCard>

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

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <AppButton onPress={onPress} size="sm" variant={active ? 'primary' : 'secondary'}>
      {label}
    </AppButton>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  codeInput: {
    flex: 1,
  },
  codeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inverseMuted: {
    color: colors.darkMuted,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
