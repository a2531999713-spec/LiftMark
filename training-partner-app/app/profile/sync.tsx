import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SecondaryPageHeader, SettingsRow, Tag } from '@/components/ui';
import {
  loadSyncDiagnostics,
  runManualPullSync,
  runManualUploadSync,
  type SyncDiagnostics,
} from '@/services/syncDiagnosticsService';
import { colors, spacing } from '@/theme';

type Notice = {
  tone: 'success' | 'danger';
  message: string;
};

function formatJson(value: unknown) {
  if (!value) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ProfileSyncRoute() {
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDiagnostics(await loadSyncDiagnostics());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '同步诊断加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const runUpload = async () => {
    setIsWorking(true);
    const result = await runManualUploadSync();
    setNotice({ tone: result.ok ? 'success' : 'danger', message: result.message });
    await load();
    setIsWorking(false);
  };

  const runPull = async () => {
    setIsWorking(true);
    const result = await runManualPullSync();
    setNotice({ tone: result.ok ? 'success' : 'danger', message: result.message });
    await load();
    setIsWorking(false);
  };

  return (
    <Screen safeTop={false} contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="云同步"
        icon="cloud-upload-outline"
        meta={diagnostics?.serverHealth === 'ok' ? 'health ok' : '需要检查'}
        subtitle="查看上传、拉取、队列、头像 URL 和服务器同步状态。"
        title="同步诊断"
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? (
        <EmptyState actionLabel="重新检查" description={error} onActionPress={() => void load()} title="诊断失败" />
      ) : null}

      {notice ? (
        <AppCard style={styles.card} tone={notice.tone === 'success' ? 'brand' : 'soft'}>
          <AppText tone={notice.tone === 'success' ? 'brand' : 'danger'} variant="bodySmall" weight="900">
            {notice.message}
          </AppText>
        </AppCard>
      ) : null}

      {diagnostics ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="subtitle" weight="900">
                连接状态
              </AppText>
              <Tag label={diagnostics.serverHealth === 'ok' ? '正常' : '失败'} tone={diagnostics.serverHealth === 'ok' ? 'success' : 'danger'} />
            </View>
            <SettingsRow label="API_BASE_URL" value={diagnostics.apiBaseUrl} />
            <SettingsRow label="登录状态" value={diagnostics.isLoggedIn ? '已登录' : '未登录'} />
            <SettingsRow label="accessToken" value={diagnostics.accessTokenPresent ? '存在' : '不存在'} />
            <SettingsRow label="服务器 health" value={diagnostics.serverHealthMessage ?? diagnostics.serverHealth} />
            <SettingsRow label="最近同步时间" value={diagnostics.lastSyncedAt ?? '-'} />
          </AppCard>

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              本地队列
            </AppText>
            <SettingsRow label="待同步数量" value={`${diagnostics.pendingCount}`} />
            <SettingsRow label="最近失败原因" value={diagnostics.lastSyncError ?? '-'} />
            <SettingsRow label="group_members" value={`${diagnostics.localCounts.groupMembers}`} />
            <SettingsRow label="member_profiles" value={`${diagnostics.localCounts.memberProfiles}`} />
            <SettingsRow label="workout_sessions" value={`${diagnostics.localCounts.workoutSessions}`} />
            <SettingsRow label="workout_sets" value={`${diagnostics.localCounts.workoutSets}`} />
          </AppCard>

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              头像链路
            </AppText>
            <SettingsRow label="最近头像 URL" value={diagnostics.recentAvatarUrl ?? '-'} />
            <SettingsRow label="头像 URL 检测" value={diagnostics.avatarAccessStatus ?? '-'} />
            <SettingsRow label="头像上传测试" value={diagnostics.avatarUploadTestResult} />
          </AppCard>

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              服务器 /sync/status
            </AppText>
            <AppText selectable style={styles.jsonText} variant="caption">
              {formatJson(diagnostics.serverStatus)}
            </AppText>
          </AppCard>

          <View style={styles.actions}>
            <AppButton disabled={isWorking} icon="cloud-upload-outline" loading={isWorking} onPress={() => void runUpload()}>
              手动上传
            </AppButton>
            <AppButton disabled={isWorking} icon="cloud-download-outline" onPress={() => void runPull()} variant="secondary">
              手动拉取
            </AppButton>
            <AppButton disabled={isWorking} icon="refresh-outline" onPress={() => void load()} variant="ghost">
              重新检查
            </AppButton>
          </View>
        </ScrollView>
      ) : null}
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  jsonText: {
    color: colors.textMuted,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  screen: {
    gap: spacing.md,
  },
});
