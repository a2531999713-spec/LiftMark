import { router } from 'expo-router';

import { AppButton, AppModalSheet } from '@/components/ui';
import type { BlockedAccessDecision } from '@/domain/auth';

import { AuthRequiredSheet } from './AuthRequiredSheet';
import { ProRequiredSheet } from './ProRequiredSheet';

export type AuthGateSheetsProps = {
  authPrompt: BlockedAccessDecision | null;
  noticePrompt: BlockedAccessDecision | null;
  onCloseAuth: () => void;
  onCloseNotice: () => void;
  onClosePro: () => void;
  proPrompt: BlockedAccessDecision | null;
};

export function AuthGateSheets({
  authPrompt,
  noticePrompt,
  onCloseAuth,
  onCloseNotice,
  onClosePro,
  proPrompt,
}: AuthGateSheetsProps) {
  return (
    <>
      <AuthRequiredSheet
        message={authPrompt?.message}
        onClose={onCloseAuth}
        onLogin={() => {
          onCloseAuth();
          router.push('/account/login' as never);
        }}
        title={authPrompt?.title}
        visible={Boolean(authPrompt)}
      />
      <ProRequiredSheet
        message={proPrompt?.message}
        onClose={onClosePro}
        onViewMembership={() => {
          onClosePro();
          router.push('/profile/membership' as never);
        }}
        title={proPrompt?.title}
        visible={Boolean(proPrompt)}
      />
      <AppModalSheet
        onClose={onCloseNotice}
        position="center"
        subtitle={noticePrompt?.message}
        title={noticePrompt?.title ?? '提示'}
        visible={Boolean(noticePrompt)}
      >
        <AppButton onPress={onCloseNotice}>知道了</AppButton>
      </AppModalSheet>
    </>
  );
}
