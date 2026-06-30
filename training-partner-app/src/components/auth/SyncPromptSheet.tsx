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
      subtitle="当前版本训练数据以本机保存为准。多设备数据能力正在开发中，后续版本开放。"
      title="本地数据说明"
      visible={visible}
    >
      <AppButton icon="information-circle-outline" onPress={onEnable}>
        知道了
      </AppButton>
      <AppButton onPress={onSkip} variant="secondary">
        关闭
      </AppButton>
    </AppModalSheet>
  );
}
