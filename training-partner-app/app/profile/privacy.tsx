import { Alert } from 'react-native';
import { useState } from 'react';

import { AppButton, AppCard, AppModalSheet, AppText, Screen } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';
import { spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfilePrivacyRoute() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const showDeveloping = (title: string) =>
    setNotice({ title, message: '该功能正在开发中，后续版本开放。' });

  const confirmLocalDelete = () => {
    Alert.alert('清空本机数据？', '训练数据涉及体重、1RM 和训练表现。当前版本只保留二次确认，不会静默执行删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空本机数据',
        style: 'destructive',
        onPress: () =>
          setNotice({
            title: '清空本机数据',
            message: '当前版本不会执行该危险操作，真实训练记录仍保存在本机 SQLite。',
          }),
      },
    ]);
  };

  const confirmAccountDeletion = () => {
    Alert.alert('注销账号并处理相关数据？', '注销账号必须单独确认。当前版本后端接口尚未接入，不会删除本机训练数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '注销账号',
        style: 'destructive',
        onPress: () => showDeveloping('账号注销'),
      },
    ]);
  };

  return (
    <Screen title="数据与隐私" subtitle="训练数据可见范围、删除和注销。">
      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          默认不公开训练细节
        </AppText>
        <AppText tone="muted" variant="caption">
          小组内默认只显示汇总，不默认公开详细重量、RPE/RIR、1RM 和身体数据。
        </AppText>
      </AppCard>

      <ProfileSection icon="eye-off-outline" title="隐私设置">
        <ProfileMenuItem icon="people-outline" label="训练数据可见范围" description="默认仅本人和本机组长可见" onPress={() => showDeveloping('训练数据可见范围')} />
        <ProfileMenuItem icon="analytics-outline" label="小组内显示" description="默认只显示汇总，不公开详细重量" onPress={() => showDeveloping('小组内显示')} />
      </ProfileSection>

      <ProfileSection icon="trash-outline" title="数据删除">
        <ProfileMenuItem danger icon="trash-outline" label="清空本机数据" description="删除前必须二次确认" onPress={confirmLocalDelete} />
        <ProfileMenuItem danger icon="cloud-offline-outline" label="删除云端数据" description="云同步接入后开放" onPress={() => showDeveloping('删除云端数据')} />
        <ProfileMenuItem danger icon="person-remove-outline" label="账号注销" description="注销账号并处理相关数据" onPress={confirmAccountDeletion} />
      </ProfileSection>

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

const styles = {
  card: {
    gap: spacing.md,
  },
};
