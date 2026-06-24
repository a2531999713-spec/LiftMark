import { useState } from 'react';
import { Alert } from 'react-native';

import { AppButton, AppModalSheet, Screen } from '@/components/ui';
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
    Alert.alert('注销账号并处理相关数据？', '账号注销必须单独确认。当前版本只保留入口，不会静默删除本机训练数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '注销账号',
        style: 'destructive',
        onPress: () => showDeveloping('账号注销'),
      },
    ]);
  };

  return (
    <Screen title="账号安全" subtitle="手机号、邮箱、密码与登录设备。">
      <ProfileSection icon="lock-closed-outline" title="账号安全">
        <ProfileMenuItem icon="call-outline" label="手机号 / 邮箱" description="账号绑定信息" onPress={() => showDeveloping('手机号 / 邮箱')} />
        <ProfileMenuItem icon="key-outline" label="修改密码" description="需要再次验证身份" onPress={() => showDeveloping('修改密码')} />
        <ProfileMenuItem icon="phone-portrait-outline" label="登录设备" description="查看当前账号登录设备" onPress={() => showDeveloping('登录设备')} />
        <ProfileMenuItem icon="log-out-outline" label="退出所有设备" description="需要服务器会话接口" onPress={() => showDeveloping('退出所有设备')} />
        <ProfileMenuItem danger icon="person-remove-outline" label="注销账号" description="注销账号并处理相关数据" onPress={confirmAccountDeletion} />
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
