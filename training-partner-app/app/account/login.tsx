import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
type AuthView = 'login' | 'register';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{4,6}$/;

export default function LoginRoute() {
  const { authStatus, isLoading, login, register, sendCode } = useAuthStore();
  const [view, setView] = useState<AuthView>('login');
  const [account, setAccount] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [nickname, setNickname] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (authStatus === 'authenticated' || authStatus === 'offline_authenticated') {
      router.replace('/(tabs)/today' as never);
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
      alert('请先同意协议', '请先同意用户协议和隐私政策。');
      return false;
    }
    return true;
  };
  const checkAccount = () => {
    const trimmed = account.trim();
    if (!trimmed) {
      alert('请输入账号', '请输入手机号、邮箱或练刻账号。');
      return null;
    }
    return trimmed;
  };
  const getPhoneForCode = () => {
    const trimmed = account.trim();
    if (!PHONE_RE.test(trimmed)) {
      alert('手机号格式错误', '注册需要使用手机号接收验证码。');
      return null;
    }
    return trimmed;
  };

  const requestRegisterCode = async () => {
    if (!checkAgreed()) return;
    const phone = getPhoneForCode();
    if (!phone || cooldown > 0 || sending) return;

    setSending(true);
    const result = await sendCode({ phone, purpose: 'register' });
    setSending(false);
    if (!result.ok) {
      alert('发送失败', result.message);
      return;
    }

    setCooldown(60);
    if (result.message) {
      alert('验证码已发送', result.message);
    }
  };

  const doLogin = async () => {
    if (!checkAgreed()) return;
    const id = checkAccount();
    if (!id) return;
    if (password.trim().length < 1) {
      alert('请输入密码', '请输入账号密码。');
      return;
    }

    const message = await login({ identifier: id, password: password.trim() });
    if (message) {
      alert('登录失败', message);
      return;
    }
    router.replace('/(tabs)/today' as never);
  };

  const doRegister = async () => {
    if (!checkAgreed()) return;
    const phone = getPhoneForCode();
    if (!phone) return;
    if (!CODE_RE.test(code.trim())) {
      alert('验证码错误', '请输入 4-6 位验证码。');
      return;
    }
    if (password.trim().length < 6) {
      alert('密码不符合要求', '密码至少 6 位。');
      return;
    }

    const message = await register({
      code: code.trim(),
      displayName: nickname.trim() || `练刻用户${phone.slice(-4)}`,
      identifier: phone,
      password: password.trim(),
    });
    if (message) {
      alert('注册失败', message);
      return;
    }
    router.replace('/(tabs)/today' as never);
  };

  const switchView = (next: AuthView) => {
    setView(next);
    setCode('');
    setPassword('');
    setNickname('');
    setShowPwd(false);
    setNotice(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
        >
          <View style={styles.hero}>
            <View style={styles.logoShell}>
              <AppText variant="headline" weight="900" style={styles.logoText}>练刻</AppText>
            </View>
            <View style={styles.heroCopy}>
              <AppText style={styles.heroTitle} variant="headline" weight="900">
                LiftMark
              </AppText>
              <AppText style={styles.heroSub} tone="muted" variant="bodySmall">
                记录每次训练，刻下持续进步
              </AppText>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.switcher}>
              <Pressable
                accessibilityRole="button"
                onPress={() => switchView('login')}
                style={[styles.switchPill, view === 'login' && styles.switchPillActive]}
              >
                <AppText tone={view === 'login' ? 'inverse' : 'muted'} variant="bodySmall" weight="900">
                  登录
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => switchView('register')}
                style={[styles.switchPill, view === 'register' && styles.switchPillActive]}
              >
                <AppText tone={view === 'register' ? 'inverse' : 'muted'} variant="bodySmall" weight="900">
                  注册
                </AppText>
              </Pressable>
            </View>

            <View style={styles.formHeader}>
              <AppText variant="title" weight="900">
                {view === 'login' ? '欢迎回来' : '创建账号'}
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                {view === 'login' ? '使用手机号、邮箱或练刻账号登录。' : '使用手机号注册，验证码将发送到手机。'}
              </AppText>
            </View>

            <Input
              icon="person-outline"
              keyboard="default"
              label={view === 'register' ? '手机号' : '账号'}
              onChangeText={setAccount}
              placeholder={view === 'register' ? '请输入手机号' : '手机号 / 邮箱 / 练刻账号'}
              value={account}
            />

            {view === 'register' ? (
              <View style={styles.codeRow}>
                <View style={styles.codeField}>
                  <Input
                    icon="keypad-outline"
                    keyboard="number-pad"
                    label="验证码"
                    onChangeText={setCode}
                    placeholder="4-6 位验证码"
                    value={code}
                  />
                </View>
                <Pressable
                  disabled={cooldown > 0 || sending}
                  onPress={() => void requestRegisterCode()}
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
            ) : null}

            <Input
              icon="lock-closed-outline"
              label="密码"
              onChangeText={setPassword}
              onToggle={() => setShowPwd((current) => !current)}
              placeholder={view === 'register' ? '设置密码，至少 6 位' : '请输入密码'}
              scrollRef={scrollRef}
              secure
              showPwd={showPwd}
              showToggle
              value={password}
            />

            {view === 'register' ? (
              <Input
                icon="text-outline"
                label="昵称"
                onChangeText={setNickname}
                placeholder="训练昵称，可稍后修改"
                value={nickname}
              />
            ) : null}

            <Agree checked={agreed} onToggle={() => setAgreed((current) => !current)} />

            <AppButton
              disabled={isLoading}
              loading={isLoading}
              onPress={() => (view === 'login' ? void doLogin() : void doRegister())}
              size="lg"
              style={styles.submitButton}
            >
              {view === 'login' ? '登录' : '完成注册'}
            </AppButton>

            {view === 'login' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => alert('找回密码', '找回密码功能正在开发中，后续版本开放。')}
                style={styles.textButton}
              >
                <AppText style={styles.switchLink} variant="caption" weight="800">
                  忘记密码？
                </AppText>
              </Pressable>
            ) : null}
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
  secure,
  showToggle,
  showPwd,
  onToggle,
  scrollRef,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  keyboard?: 'phone-pad' | 'number-pad' | 'default';
  label: string;
  onChangeText: (value: string) => void;
  onToggle?: () => void;
  placeholder: string;
  scrollRef?: React.RefObject<ScrollView | null>;
  secure?: boolean;
  showPwd?: boolean;
  showToggle?: boolean;
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
          onFocus={() => {
            if (secure && scrollRef?.current) {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 260);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secure && !showPwd}
          style={styles.fieldInput}
          value={value}
        />
        {showToggle ? (
          <Pressable hitSlop={8} onPress={onToggle}>
            <Ionicons color={colors.textMuted} name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={18} />
          </Pressable>
        ) : null}
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
    paddingHorizontal: spacing.md,
    minWidth: 96,
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
  switcher: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  switchLink: {
    color: colors.primary,
  },
  switchPill: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  switchPillActive: {
    backgroundColor: colors.dark,
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
