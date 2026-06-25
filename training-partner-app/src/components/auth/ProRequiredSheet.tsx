import { AppButton, AppModalSheet } from '@/components/ui';

type ProRequiredSheetProps = {
  message?: string;
  onClose: () => void;
  onViewMembership: () => void;
  title?: string;
  visible: boolean;
};

export function ProRequiredSheet({
  message,
  onClose,
  onViewMembership,
  title = '开通 Pro，解锁完整训练小组',
  visible,
}: ProRequiredSheetProps) {
  return (
    <AppModalSheet
      onClose={onClose}
      position="center"
      subtitle={
        message ??
        'Pro 支持最多 4 人一起练、更多训练计划、完整计划编辑器、高级历史趋势、自动进阶建议、完整云同步和 2 个 Pro 小组。'
      }
      title={title}
      visible={visible}
    >
      <AppButton icon="diamond-outline" onPress={onViewMembership}>
        查看 Pro 权益
      </AppButton>
      <AppButton onPress={onClose} variant="secondary">
        暂不开通
      </AppButton>
    </AppModalSheet>
  );
}
