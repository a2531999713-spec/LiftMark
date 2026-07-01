import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Screen, SecondaryPageHeader } from '@/components/ui';
import { AppButton, AppText } from '@/components/ui';
import { joinGroupByInvitation } from '@/services/invitationService';
import { colors, radius, spacing } from '@/theme';

export default function JoinGroupRoute() {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 6) {
      setError('请输入完整的邀请码。');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const result = await joinGroupByInvitation(trimmedCode);
      if (result.ok) {
        Alert.alert(
          '加入成功',
          result.group ? `已加入小组「${result.group.name}」` : '已成功加入小组。',
          [
            {
              text: '确定',
              onPress: () => router.replace('/(tabs)/today'),
            },
          ]
        );
      } else {
        setError(result.message || '加入失败，请检查邀请码是否正确。');
      }
    } catch {
      setError('网络错误，请稍后重试。');
    } finally {
      setIsJoining(false);
    }
  }, [code]);

  return (
    <Screen>
      <SecondaryPageHeader
        caption="小组"
        icon="enter-outline"
        subtitle="输入朋友分享的邀请码，加入训练小组。"
        title="加入小组"
      />

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Ionicons color={colors.darkMuted} name="key-outline" size={24} />
          <TextInput
            autoCapitalize="characters"
            autoFocus
            editable={!isJoining}
            maxLength={8}
            onChangeText={setCode}
            placeholder="输入邀请码"
            placeholderTextColor={colors.darkMuted}
            style={styles.input}
            value={code}
          />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
            <AppText variant="caption" style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}

        <AppButton
          disabled={isJoining || code.trim().length < 6}
          onPress={() => void handleJoin()}
          style={styles.joinButton}
        >
          {isJoining ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            '加入小组'
          )}
        </AppButton>

        <View style={styles.helpSection}>
          <AppText variant="caption" tone="muted" style={styles.helpTitle}>
            如何获取邀请码？
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.helpText}>
            让小组创建者在「邀请成员」页面生成邀请码，然后分享给你。
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  input: {
    color: colors.textStrong,
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  errorText: {
    color: colors.danger,
  },
  joinButton: {
    marginTop: spacing.md,
  },
  helpSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  helpTitle: {
    fontWeight: '600',
  },
  helpText: {
    textAlign: 'center',
  },
});
