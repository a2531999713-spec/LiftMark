import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { colors, radius, shadows, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const CODE_PATTERN = /^\d{4,8}$/;

export default function LoginRoute() {
  const { authStatus, isLoading, loginWithCode, sendCode } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isSendingCode, setSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (authStatus === 'authenticated' || authStatus === 'offline_authenticated') {
      router.replace('/(tabs)/today' as never);
    }
  }, [authStatus]);

  useEffect(() => {
    if (codeCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCodeCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCooldown]);

  const showNotice = (title: string, message: string) => {
    setNotice({ title, message });
  };

  const normalizePhone = () => phone.trim();

  const validateAgreement = () => {
    if (hasAgreed) return true;
    showNotice('请先同意协议', '请先同意用户协议和隐私政策');
    return false;
  };

  const validatePhone = () => {
    const normalizedPhone = normalizePhone();
    if (!normalizedPhone) {
      showNotice('请输入手机号', '请输入手机号');
      return null;
    }
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      showNotice('手机号格式错误', '请输入正确的手机号');
      return null;
    }
    return normalizedPhone;
  };

  const validateCode = () => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      showNotice('请输入验证码', '请输入验证码');
      return null;
    }
    if (!CODE_PATTERN.test(normalizedCode)) {
      showNotice('验证码格式错误', '请输入正确的验证码');
      return null;
    }
    return normalizedCode;
  };

  const requestCode = async () => {
    if (!validateAgreement()) return;
    const normalizedPhone = validatePhone();
    if (!normalizedPhone || codeCooldown > 0 || isSendingCode) return;

    setSendingCode(true);
    const result = await sendCode({ phone: normalizedPhone, purpose: 'login' });
    setSendingCode(false);

    if (!result.ok) {
      showNotice('验证码发送失败', result.message);
      return;
    }

    setCodeCooldown(60);
    showNotice('验证码已发送', result.message ?? '验证码已发送');
  };

  const submit = async () => {
    if (!validateAgreement()) return;
    const normalizedPhone = validatePhone();
    const normalizedCode = validateCode();
    if (!normalizedPhone || !normalizedCode) return;

    const message = await loginWithCode({ phone: normalizedPhone, code: normalizedCode });
    if (message) {
      showNotice('登录失败', message);
      return;
    }

    router.replace('/(tabs)/today' as never);
  };

  const showDeveloping = (name: string) => {
    showNotice(name, '该功能正在开发中，后续版本开放。');
  };

  const canRequestCode = codeCooldown <= 0 && !isSendingCode;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <Ionicons color={colors.surface} name="flash" size={30} />
            </View>
            <AppText style={styles.brandTitle} weight="900">
              练刻 LiftMark
            </AppText>
            <AppText style={styles.subtitle} tone="muted" weight="700">
              你的力量训练计划执行器
            </AppText>
          </View>

          <View style={styles.formPanel}>
            <View style={styles.formHeader}>
              <AppText variant="headline" weight="900">
                手机号登录 / 注册
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                首次登录成功后即可进入练刻
              </AppText>
            </View>

            <Field
              icon="phone-portrait-outline"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="请输入手机号"
              value={phone}
            />

            <View style={styles.codeRow}>
              <Field
                containerStyle={styles.codeField}
                icon="keypad-outline"
                keyboardType="number-pad"
                onChangeText={setCode}
                placeholder="请输入验证码"
                value={code}
              />
              <AppButton
              disabled={!canRequestCode}
                loading={isSendingCode}
                onPress={() => void requestCode()}
                size="sm"
                style={styles.codeButton}
                variant="secondary"
              >
                {codeCooldown > 0 ? `${codeCooldown} 秒后重发` : '获取验证码'}
              </AppButton>
            </View>

            <AgreementRow
              checked={hasAgreed}
              onPressAgreement={() => showDeveloping('用户协议')}
              onPressPrivacy={() => showDeveloping('隐私政策')}
              onToggle={() => setHasAgreed((value) => !value)}
            />

            <AppButton
              disabled={isLoading}
              loading={isLoading}
              onPress={() => void submit()}
              size="lg"
              style={styles.submitButton}
            >
              登录 / 注册
            </AppButton>
          </View>

          <View style={styles.footer}>
            <AppText style={styles.footerText} tone="subtle" variant="caption">
              已登录用户离线时可进入本机模式
            </AppText>
            <AppText style={styles.footerText} tone="subtle" variant="caption">
              首次登录需要联网完成手机号验证
            </AppText>
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

function Field({
  containerStyle,
  icon,
  keyboardType,
  onChangeText,
  placeholder,
  value,
}: {
  containerStyle?: object;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType: 'phone-pad' | 'number-pad';
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Ionicons color={colors.textMuted} name={icon} size={18} />
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function AgreementRow({
  checked,
  onPressAgreement,
  onPressPrivacy,
  onToggle,
}: {
  checked: boolean;
  onPressAgreement: () => void;
  onPressPrivacy: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={styles.agreementRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={[styles.checkbox, checked && styles.checkboxChecked]}
      >
        {checked ? <Ionicons color={colors.surface} name="checkmark" size={15} /> : null}
      </Pressable>
      <View style={styles.agreementTextWrap}>
        <AppText tone="muted" variant="caption">
          我已阅读并同意
        </AppText>
        <Pressable accessibilityRole="link" onPress={onPressAgreement}>
          <AppText style={styles.agreementLink} variant="caption" weight="800">
            《用户协议》
          </AppText>
        </Pressable>
        <AppText tone="muted" variant="caption">
          和
        </AppText>
        <Pressable accessibilityRole="link" onPress={onPressPrivacy}>
          <AppText style={styles.agreementLink} variant="caption" weight="800">
            《隐私政策》
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  agreementLink: {
    color: colors.textStrong,
  },
  agreementRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  agreementTextWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    minHeight: 28,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxxxl,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 68,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 68,
    ...shadows.card,
  },
  brandTitle: {
    color: colors.textStrong,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  codeButton: {
    alignSelf: 'stretch',
    minWidth: 118,
  },
  codeField: {
    flex: 1,
  },
  codeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  footer: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  footerText: {
    textAlign: 'center',
  },
  formHeader: {
    gap: spacing.xs,
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
    ...shadows.card,
  },
  input: {
    color: colors.textStrong,
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: '700',
    minHeight: 38,
    padding: 0,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.backgroundElevated,
    flex: 1,
  },
  submitButton: {
    borderRadius: radius.xl,
    minHeight: 58,
  },
  subtitle: {
    textAlign: 'center',
  },
});
