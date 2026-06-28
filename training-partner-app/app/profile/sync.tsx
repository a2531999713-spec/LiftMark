import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, Screen, SettingsRow, Tag } from '@/components/ui';
import { useSyncStore } from '@/store/syncStore';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfileSyncRoute() {
  const { guardFeature, sheets } = useAuthGate();
  const {
    lastSyncedAt,
    loadSyncState,
    pendingCount,
    preferences,
    requestSync,
    setPreferences,
    status,
  } = useSyncStore();
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadSyncState();
    }, [loadSyncState]),
  );

  const enableSync = () => {
    if (!guardFeature('cloud_sync')) {
      return;
    }

    Alert.alert(
      '开启云同步？',
      '开启后，练刻会将你的成员档案、训练计划、训练记录和训练进度同步到云端。你卸载重装、换手机或重新登录后，可以恢复数据。你可以随时在设置中关闭云同步。',
      [
        { text: '暂不开启', style: 'cancel' },
        {
          text: '开启云同步',
          onPress: () => {
            void setPreferences({ ...preferences, enabled: true });
            setNotice({ title: '云同步', message: '云同步已开启，你的训练数据将自动同步到云端。' });
          },
        },
      ],
    );
  };

  const disableSync = () => {
    if (!guardFeature('cloud_sync')) {
      return;
    }

    Alert.alert(
      '关闭云同步？',
      '关闭云同步后，新产生的训练数据只会保存在当前设备。卸载 App、清空数据或更换手机后，未上传的数据将无法自动恢复。',
      [
        { text: '继续开启', style: 'cancel' },
        {
          text: '确认关闭',
          style: 'destructive',
          onPress: () => void setPreferences({ ...preferences, enabled: false }),
        },
      ],
    );
  };

  const syncNow = async () => {
    if (!guardFeature('cloud_sync')) {
      return;
    }

    const message = await requestSync();
    setNotice({ title: '立即同步', message: message ?? '同步请求已提交。' });
  };

  return (
    <Screen title="云同步" subtitle="将训练数据同步到云端。">
      <AppCard style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <AppText variant="title" weight="900">
              云同步
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              将训练数据同步到云端，换机也能恢复
            </AppText>
          </View>
          <Tag label={preferences.enabled ? '已开启' : '未开启'} tone={preferences.enabled ? 'success' : 'neutral'} />
        </View>
        <SettingsRow label="同步状态" value={status === 'disabled' ? '未开启' : status === 'failed' ? '连接失败' : '服务已连接'} />
        <SettingsRow label="最近同步时间" value={lastSyncedAt ?? '暂无'} />
        <SettingsRow label="待同步数量" value={`${pendingCount}`} />
        <SettingsRow
          label="仅 Wi-Fi 同步"
          right={
            <Switch
              onValueChange={(wifiOnly) => void setPreferences({ ...preferences, wifiOnly })}
              thumbColor={preferences.wifiOnly ? colors.primary : colors.surface}
              value={preferences.wifiOnly}
            />
          }
        />
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={preferences.enabled ? disableSync : enableSync}>
          {preferences.enabled ? '关闭云同步' : '开启云同步'}
        </AppButton>
        <AppButton onPress={() => void syncNow()} variant="secondary">
          立即同步
        </AppButton>
        <AppButton
          onPress={() => {
            if (guardFeature('cloud_sync')) {
              setNotice({ title: '从云端恢复', message: '该功能正在开发中，后续版本开放。' });
            }
          }}
          variant="secondary"
        >
          从云端恢复
        </AppButton>
        <AppButton
          onPress={() => {
            if (guardFeature('cloud_sync')) {
              setNotice({ title: '清空云端数据', message: '该功能正在开发中，后续版本开放。' });
            }
          }}
          variant="secondary"
        >
          清空云端数据
        </AppButton>
      </View>

      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          数据安全有保障
        </AppText>
        <AppText tone="muted" variant="caption">
          训练记录会自动保存，云同步确保数据不会丢失。
        </AppText>
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

      <AuthGateSheets {...sheets} />
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
