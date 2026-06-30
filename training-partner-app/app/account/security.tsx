import { useState } from 'react';
import { Alert } from 'react-native';

import { AppButton, AppModalSheet, Screen, SecondaryPageHeader } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';

type NoticeState = {
  message: string;
  title: string;
};

const developing = '该功能正在开发中，后续版本开放。';

export default function AccountSecurityRoute() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const showDeveloping = (title: string) => setNotice({ title, message: developing });

  const confirmAccountDeletion = () => {
    Alert.alert('确定注销账号？', '注销后，你的账号数据将被删除，此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '注销账号',
        style: 'destructive',
        onPress: () => showDeveloping('账号注销'),
      },
    ]);
  };

  return (
    <Screen>
      <SecondaryPageHeader
        caption="账号安全"
        icon="lock-closed-outline"
        meta="本机优先"
        subtitle="手机号登录、密码和设备状态会逐步接入，训练数据不在这里清空。"
        title="登录保护"
      />
      <ProfileSection icon="lock-closed-outline" title="登录与绑定">
        <ProfileMenuItem icon="call-outline" label="手机号 / 邮箱" description="绑定信息" onPress={() => showDeveloping('手机号 / 邮箱')} />
        <ProfileMenuItem icon="key-outline" label="修改密码" description="需要验证身份" onPress={() => showDeveloping('修改密码')} />
        <ProfileMenuItem icon="phone-portrait-outline" label="登录设备" description="查看登录设备" onPress={() => showDeveloping('登录设备')} />
        <ProfileMenuItem danger icon="person-remove-outline" label="注销账号" description="删除账号数据，不可撤销" onPress={confirmAccountDeletion} />
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
