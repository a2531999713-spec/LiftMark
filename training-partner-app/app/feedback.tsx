import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Screen, SecondaryPageHeader, SettingsRow } from '@/components/ui';
import { spacing } from '@/theme';

type Notice = {
  message: string;
  title: string;
};

export default function FeedbackRoute() {
  const [notice, setNotice] = useState<Notice | null>(null);

  const showDeveloping = (title: string) => {
    setNotice({ title, message: '该功能正在开发中，后续版本开放。' });
  };

  const confirmClearCache = () => {
    Alert.alert('确认清理缓存？', '当前版本不会删除训练记录。后续版本会提供更细的缓存清理能力。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => showDeveloping('清理缓存'),
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="反馈与诊断"
        icon="chatbubble-ellipses-outline"
        subtitle="反馈表单已上移到账户面板，这里仅保留开发诊断。"
        title="反馈与诊断"
      />

      <AppCard style={styles.card}>
        <AppText variant="subtitle" weight="900">
          反馈
        </AppText>
        <View style={styles.actions}>
          <AppButton onPress={() => showDeveloping('问题反馈')}>问题反馈</AppButton>
          <AppButton onPress={() => showDeveloping('功能建议')} variant="secondary">
            功能建议
          </AppButton>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SettingsRow label="当前版本" value={Constants.expoConfig?.version ?? '0.1.0'} />
        <SettingsRow label="Android package" value="com.liftmark.app" />
        <SettingsRow label="本地数据库" value="随 App 启动检查" />
        <SettingsRow label="云同步" value="可在云同步页手动检查" />
      </AppCard>

      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          诊断信息
        </AppText>
        <AppText tone="muted" variant="caption">
          如果训练数据、头像或同步状态异常，请先在云同步页查看队列和本地数据库结构。
        </AppText>
        <AppButton onPress={() => showDeveloping('导出诊断信息')} variant="secondary">
          导出诊断信息
        </AppButton>
      </AppCard>

      <AppCard style={styles.card}>
        <AppText variant="bodySmall" weight="900">
          缓存
        </AppText>
        <AppText tone="muted" variant="caption">
          危险操作会二次确认，不会直接删除训练记录。
        </AppText>
        <AppButton onPress={confirmClearCache} variant="danger">
          清理缓存
        </AppButton>
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

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
