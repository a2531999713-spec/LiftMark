import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppModalSheet, AppText } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = { message: string; title: string };
type LoginMode = 'password' | 'sms';

const PHONE_RE = /^1[3-9]\d{9}$/;
const LIFTMARK_ID_RE = /^LM[A-Z0-9]{6,16}$/i;
const CODE_RE = /^\d{4,6}$/;

export default function LoginRoute() {
  const { authStatus, isLoading, login, loginWithCode, sendCode } = useAuthStore();
  const [mode, setMode] = useState<LoginMode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (authStatus === 'authenticated' || authStatus === 'offline_authenticated') {
      router.replace('/onboarding/training-profile' as never);
    }
  }, [authStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const alert = (title: string, message: string) => setNotice({ title, message });

  const checkAgreed = () => {
    if (!agreed) {
      alert('请先同意协议', '登录或注册前，请先阅读并同意用户协议和隐私政策。');
      return false;
    }
    return true;
  };

  const getValidPhone = () => {
    const trimmed = phone.trim();
    if (!PHONE_RE.test(trimmed)) {
      alert('手机号格式错误', '请输入 11 位中国大陆手机号。');
      return null;
    }
    return trimmed;
  };

  const requestLoginCode = async () => {
    if (!checkAgreed()) return;
    const validPhone = getValidPhone();
    if (!validPhone || cooldown > 0 || sending) return;

    setSending(true);
    const result = await sendCode({ phone: validPhone, purpose: 'login' });
    setSending(false);
    if (!result.ok) {
      alert('发送失败', result.message);
      return;
    }

    setCooldown(60);
    alert('验证码已发送', result.message ?? '验证码已发送，请查看短信。');
  };

  const doLogin = async () => {
    if (!checkAgreed()) return;
    if (mode === 'password') {
      const account = identifier.trim();
      if (!PHONE_RE.test(account) && !LIFTMARK_ID_RE.test(account)) {
        alert('账号格式错误', '请输入手机号或练刻 ID。');
        return;
      }
      if (password.length < 6) {
        alert('密码格式错误', '请输入至少 6 位密码。');
        return;
      }

      const message = await login({ identifier: account, password });
      if (message) {
        alert('登录失败', message);
        return;
      }
      router.replace('/onboarding/training-profile' as never);
      return;
    }

    const validPhone = getValidPhone();
    if (!validPhone) return;
    if (!CODE_RE.test(code.trim())) {
      alert('验证码错误', '请输入 4-6 位短信验证码。');
      return;
    }

    const message = await loginWithCode({ phone: validPhone, code: code.trim() });
    if (message) {
      alert('登录失败', message);
      return;
    }
    router.replace('/onboarding/training-profile' as never);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoShell}>
              <AppText variant="headline" weight="900" style={styles.logoText}>
                练刻
              </AppText>
            </View>
            <View style={styles.heroCopy}>
              <AppText style={styles.heroTitle} variant="headline" weight="900">
                LiftMark
              </AppText>
              <AppText style={styles.heroSub} tone="muted" variant="bodySmall">
                使用手机号 / 练刻 ID 密码登录；也可以用手机号短信验证码登录，新手机号会自动注册。
              </AppText>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.formHeader}>
              <AppText variant="title" weight="900">
                登录练刻
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                账号、密码和验证码只用于身份验证。
              </AppText>
            </View>

            <View style={styles.modeSwitch}>
              <ModeButton active={mode === 'password'} label="密码登录" onPress={() => setMode('password')} />
              <ModeButton active={mode === 'sms'} label="短信登录 / 注册" onPress={() => setMode('sms')} />
            </View>

            {mode === 'password' ? (
              <>
                <Input
                  icon="person-circle-outline"
                  label="手机号 / 练刻 ID"
                  onChangeText={setIdentifier}
                  placeholder="请输入手机号或练刻 ID"
                  value={identifier}
                />
                <Input
                  icon="lock-closed-outline"
                  label="密码"
                  onChangeText={setPassword}
                  placeholder="请输入密码"
                  rightAccessory={
                    <Pressable
                      accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
                      accessibilityRole="button"
                      onPress={() => setShowPassword((current) => !current)}
                      style={styles.passwordToggle}
                    >
                      <Ionicons color={colors.textMuted} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} />
                    </Pressable>
                  }
                  secureTextEntry={!showPassword}
                  value={password}
                />
              </>
            ) : (
              <>
                <Input
                  icon="phone-portrait-outline"
                  keyboard="phone-pad"
                  label="手机号"
                  onChangeText={setPhone}
                  placeholder="请输入手机号"
                  value={phone}
                />

                <View style={styles.codeRow}>
                  <View style={styles.codeField}>
                    <Input
                      icon="keypad-outline"
                      keyboard="number-pad"
                      label="验证码"
                      onChangeText={setCode}
                      placeholder="4-6 位短信验证码"
                      value={code}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={cooldown > 0 || sending}
                    onPress={() => void requestLoginCode()}
                    style={[styles.codeBtn, (cooldown > 0 || sending) && styles.codeBtnOff]}
                  >
                    <AppText
                      style={cooldown > 0 || sending ? styles.codeBtnOffText : styles.codeBtnText}
                      variant="caption"
                      weight="900"
                    >
                      {cooldown > 0 ? `${cooldown}s` : sending ? '发送中' : '获取验证码'}
                    </AppText>
                  </Pressable>
                </View>
              </>
            )}

            <Agree checked={agreed} onToggle={() => setAgreed((current) => !current)} />

            <AppButton
              disabled={isLoading}
              loading={isLoading}
              onPress={() => void doLogin()}
              size="lg"
              style={styles.submitButton}
            >
              {mode === 'password' ? '登录' : '登录 / 注册'}
            </AppButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </SafeAreaView>
  );
}

function Input({
  icon,
  keyboard,
  label,
  onChangeText,
  placeholder,
  rightAccessory,
  secureTextEntry,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  keyboard?: 'phone-pad' | 'number-pad' | 'default';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  rightAccessory?: ReactNode;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel} variant="caption" weight="700">
        {label}
      </AppText>
      <View style={styles.fieldRow}>
        <Ionicons color={colors.textMuted} name={icon} size={16} />
        <TextInput
          keyboardType={keyboard}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secureTextEntry}
          style={styles.fieldInput}
          value={value}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

function Agree({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <View style={styles.agree}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={[styles.agreeBox, checked && styles.agreeBoxOn]}
      >
        {checked ? <Ionicons color={colors.surface} name="checkmark" size={11} /> : null}
      </Pressable>
      <View style={styles.agreeText}>
        <AppText tone="muted" variant="caption">
          已阅读并同意
        </AppText>
        <Pressable onPress={() => router.push('/terms' as never)}>
          <AppText style={styles.agreeLink} variant="caption" weight="800">
            用户协议
          </AppText>
        </Pressable>
        <AppText tone="muted" variant="caption">
          和
        </AppText>
        <Pressable onPress={() => router.push('/privacy' as never)}>
          <AppText style={styles.agreeLink} variant="caption" weight="800">
            隐私政策
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && styles.modeButtonPressed]}
    >
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  agree: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  agreeBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 17,
    justifyContent: 'center',
    marginTop: 2,
    width: 17,
  },
  agreeBoxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  agreeLink: {
    color: colors.primary,
  },
  agreeText: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  codeBtn: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    marginTop: 22,
    minWidth: 96,
    paddingHorizontal: spacing.md,
  },
  codeBtnOff: {
    backgroundColor: colors.surfaceMuted,
  },
  codeBtnOffText: {
    color: colors.textMuted,
  },
  codeBtnText: {
    color: colors.primary,
  },
  codeField: {
    flex: 1,
  },
  codeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    gap: 6,
  },
  fieldInput: {
    color: colors.textStrong,
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    height: 44,
  },
  fieldLabel: {
    color: colors.textMuted,
    marginLeft: 2,
  },
  fieldRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  flex: {
    flex: 1,
  },
  formHeader: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  heroCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroSub: {
    maxWidth: 280,
    textAlign: 'center',
  },
  heroTitle: {
    color: colors.textStrong,
    letterSpacing: 1,
  },
  logoShell: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  logoText: {
    color: colors.surface,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonPressed: {
    opacity: 0.82,
  },
  modeSwitch: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  passwordToggle: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: 96,
  },
  submitButton: {
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },
});
