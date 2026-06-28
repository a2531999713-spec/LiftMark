import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';

export default function AccountSettingsRoute() {
  return (
    <Screen subtitle="安全、同步、会员与数据。">
      <ProfileSection icon="shield-checkmark-outline" title="账号设置">
        <ProfileMenuItem
          description="手机号、密码、登录设备"
          icon="lock-closed-outline"
          label="账号安全"
          onPress={() => router.push('/account/security' as never)}
        />
        <ProfileMenuItem
          description="同步训练数据到云端"
          icon="cloud-outline"
          label="数据同步"
          onPress={() => router.push('/profile/sync' as never)}
        />
        <ProfileMenuItem
          description="会员权益、激活码"
          icon="diamond-outline"
          label="会员与激活"
          onPress={() => router.push('/profile/membership' as never)}
        />
        <ProfileMenuItem
          description="清除训练数据"
          icon="finger-print-outline"
          label="数据管理"
          onPress={() => router.push('/profile/privacy' as never)}
        />
      </ProfileSection>
    </Screen>
  );
}
