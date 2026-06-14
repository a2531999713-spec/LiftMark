import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, SettingsRow, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { initializeLocalDatabase } from '@/data/local';
import type { ActivationState } from '@/domain/activation/activation.types';
import { getTrialDaysLeft, TEST_ACTIVATION_CODES } from '@/domain/activation/activation.service';
import { createActivationService } from '@/services/activationService';
import { colors, radius, spacing, typography } from '@/theme';

export default function ActivationRoute() {
  const service = useMemo(() => createActivationService(), []);
  const [state, setState] = useState<ActivationState | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      setState(await service.getState());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '激活状态加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useFocusEffect(
    useCallback(() => {
      void loadState();
    }, [loadState]),
  );

  const activate = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await service.activate(code);
      setState(result.state);
      Alert.alert(result.ok ? '激活成功' : '激活失败', result.message);
    } catch (activateError) {
      Alert.alert('激活失败', activateError instanceof Error ? activateError.message : '激活码校验失败。');
    } finally {
      setIsSaving(false);
    }
  }, [code, service]);

  return (
    <Screen title="输入激活码" subtitle="第一版仅支持本地测试激活，不包含账号和支付。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="激活页暂时不可用" description={error} /> : null}

      {!isLoading && state ? (
        <>
          <VisualHeroCard
            eyebrow={state.isActivated ? '已激活' : '试用模式'}
            icon="key-outline"
            imageSource={liftmarkImages.recoveryHero}
            minHeight={164}
            subtitle={state.isActivated ? '完整测试功能已启用。' : '输入激活码后可解锁完整测试功能。'}
            title="练刻 LiftMark 激活"
          />

          <AppCard style={styles.card}>
            <SectionHeader title="当前状态" />
            <SettingsRow label="激活状态" right={<Tag label={state.isActivated ? '已激活' : '试用模式'} tone={state.isActivated ? 'success' : 'warning'} />} />
            <SettingsRow label="试用剩余" value={`${getTrialDaysLeft(state)} 天`} />
            <SettingsRow label="设备 ID" value={state.deviceId} />
            <SettingsRow label="App 版本" value={state.appVersion} />
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader subtitle="测试码可用于本机验证，后续再接远程校验。" title="输入激活码" />
            <View style={styles.inputBox}>
              <Ionicons color={colors.textMuted} name="key-outline" size={20} />
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
            <AppButton disabled={isSaving || !code.trim()} onPress={() => void activate()} size="lg">
              {isSaving ? '激活中...' : '激活'}
            </AppButton>
            <AppText tone="muted" variant="caption">
              本地测试激活码：{TEST_ACTIVATION_CODES[0]}
            </AppText>
          </AppCard>

          <AppCard style={styles.card} tone="brand">
            <SectionHeader title="试用说明" />
            <AppText variant="bodySmall" weight="900">
              当前为试用模式，输入激活码后可解锁完整测试功能。
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              基础浏览、少量测试数据和基础训练体验可用；高级导出、计划分享、远程计划库和云同步后续会要求激活。
            </AppText>
          </AppCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  inputBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 42,
  },
});
