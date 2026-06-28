import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen } from '@/components/ui';
import { ProfileMenuItem, ProfileSection } from '@/components/profile';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import { exportLocalDataJson, exportWorkoutDataJson } from '@/services/exportService';
import { createCurrentPlanFile, serializePlanFile } from '@/services/planFileService';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

type ExportPrompt = NoticeState & {
  content: string;
};

export default function ProfileDataRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [exportPrompt, setExportPrompt] = useState<ExportPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      setGroup(await repositories.groupRepository.getDefaultGroup());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '数据管理加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const showExport = (title: string, content: string) => {
    setExportPrompt({
      content,
      title,
      message: `内容已生成，大小约 ${Math.ceil(content.length / 1024)} KB。当前版本暂未保存到文件，你可以先复制内容；后续版本会接入保存和分享。`,
    });
  };

  const runExport = async (type: 'all' | 'workout' | 'plan') => {
    setIsWorking(true);
    try {
      if (type === 'all') {
        showExport('导出个人数据', await exportLocalDataJson());
      } else if (type === 'workout') {
        showExport('导出训练记录', await exportWorkoutDataJson());
      } else if (group) {
        showExport('导出当前计划', serializePlanFile(await createCurrentPlanFile(repositories, group.activePlanId)));
      }
    } catch (exportError) {
      setNotice({ title: '导出失败', message: exportError instanceof Error ? exportError.message : '导出失败。' });
    } finally {
      setIsWorking(false);
    }
  };

  const confirmClearLocalData = () => {
    Alert.alert('确定清除所有数据？', '此操作将删除训练记录、计划和个人数据，且不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除数据',
        style: 'destructive',
        onPress: () =>
          setNotice({
            title: '清除数据',
            message: '数据清除功能正在完善中，即将开放。',
          }),
      },
    ]);
  };

  const copyExportContent = async () => {
    if (!exportPrompt) return;
    await Clipboard.setStringAsync(exportPrompt.content);
    setExportPrompt(null);
    setNotice({ title: '已复制内容', message: '导出内容已复制到剪贴板。当前版本还不会自动保存文件。' });
  };

  return (
    <Screen title="训练数据" subtitle="导出备份、清除数据。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <ProfileSection icon="disc-outline" title="数据管理">
            <ProfileMenuItem disabled={isWorking} icon="download-outline" label="导出个人数据" description="导出成员、计划和训练记录" onPress={() => void runExport('all')} />
            <ProfileMenuItem disabled={isWorking} icon="bar-chart-outline" label="导出训练记录" description="只导出训练记录和建议" onPress={() => void runExport('workout')} />
            <ProfileMenuItem disabled={isWorking || !group} icon="document-text-outline" label="导出当前计划" description="导出训练计划文件" onPress={() => void runExport('plan')} />
            <ProfileMenuItem icon="cloud-download-outline" label="从备份恢复" description="恢复文件校验完成后开放" onPress={() => setNotice({ title: '从备份恢复', message: '该功能正在开发中，后续版本开放。' })} tag="开发中" />
            <ProfileMenuItem danger icon="trash-outline" label="清除所有数据" description="删除前必须二次确认" onPress={confirmClearLocalData} />
          </ProfileSection>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setExportPrompt(null)}
        subtitle={exportPrompt?.message}
        title={exportPrompt?.title ?? '内容已生成'}
        visible={Boolean(exportPrompt)}
      >
        <View style={styles.modalActions}>
          <AppButton disabled={isWorking} onPress={() => void copyExportContent()}>
            复制内容
          </AppButton>
          <AppButton onPress={() => setExportPrompt(null)} variant="secondary">
            知道了
          </AppButton>
        </View>
      </AppModalSheet>

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
  card: {
    gap: spacing.md,
  },
  modalActions: {
    gap: spacing.sm,
  },
});
