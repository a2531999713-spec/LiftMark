import { AppButton, AppModalSheet } from '@/components/ui';

type SyncPromptSheetProps = {
  onEnable: () => void;
  onSkip: () => void;
  visible: boolean;
};

export function SyncPromptSheet({ onEnable, onSkip, visible }: SyncPromptSheetProps) {
  return (
    <AppModalSheet
      onClose={onSkip}
      position="center"
      subtitle="开启后，练刻会将你的成员档案、训练计划、训练记录和训练进度同步到云端。你卸载重装、换手机或重新登录后，可以恢复数据。你可以随时在设置中关闭云同步。"
      title="开启云同步？"
      visible={visible}
    >
      <AppButton icon="cloud-upload-outline" onPress={onEnable}>
        开启云同步
      </AppButton>
      <AppButton onPress={onSkip} variant="secondary">
        暂不开启
      </AppButton>
    </AppModalSheet>
  );
}
