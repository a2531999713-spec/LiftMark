import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppText, EmptyState, Screen, SecondaryPageHeader } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import {
  acceptPendingTraining,
  getPendingTrainingItems,
  rejectPendingTraining,
  type PendingTrainingItem,
} from '@/services/pendingTrainingService';
import { syncServerDataToLocal } from '@/services/profileSyncService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function PendingTrainingRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const user = useAuthStore((state) => state.user);
  const [items, setItems] = useState<PendingTrainingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pendingItems = await getPendingTrainingItems();
      setItems(pendingItems);
    } catch {
      setError('加载待确认数据失败。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadItems]);

  const saveAcceptedItemToLocal = useCallback(
    async (
      item: PendingTrainingItem,
      accepted: { sessionData?: PendingTrainingItem['sessionData']; setsData?: PendingTrainingItem['setsData'] },
    ) => {
      await syncServerDataToLocal();
      await initializeLocalDatabase();
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((candidate) => candidate.id === item.groupId) ?? null;
      const members = await repositories.memberRepository.listMembers(item.groupId);
      const currentMember = members.find((member) => member.userId === user?.id);
      if (!group || !currentMember) {
        throw new Error('本地小组成员尚未同步完成。');
      }

      const setsByExerciseId = new Map<string, PendingTrainingItem['setsData']>();
      for (const set of accepted.setsData ?? item.setsData) {
        const list = setsByExerciseId.get(set.exerciseId) ?? [];
        list.push(set);
        setsByExerciseId.set(set.exerciseId, list);
      }

      await repositories.workoutRepository.createManualSession({
        groupId: item.groupId,
        planId: group.activePlanId,
        date: accepted.sessionData?.date ?? item.sessionData.date,
        title: accepted.sessionData?.title ?? item.sessionData.title ?? '组员上传的训练',
        memberId: currentMember.id,
        completed: true,
        exercises: Array.from(setsByExerciseId.entries()).map(([exerciseId, sets], exerciseIndex) => ({
          exerciseId,
          notes: '待确认数据接受',
          priority: exerciseIndex === 0 ? 'A' : exerciseIndex <= 2 ? 'B' : 'C',
          sets: sets.map((set) => ({
            completed: set.completed !== false && !set.skipped,
            notes: set.notes,
            reps: set.reps,
            weight: set.weight,
          })),
        })),
      });
    },
    [repositories, user?.id],
  );

  const handleAccept = useCallback(async (item: PendingTrainingItem) => {
    Alert.alert(
      '确认接受训练数据',
      `接受 ${item.uploader.nickname} 为你记录的训练？\n\n日期：${item.sessionData.date}\n组数：${item.setsData.length}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '接受',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              const result = await acceptPendingTraining(item.id);
              if (result.ok) {
                let localSaved = true;
                try {
                  await saveAcceptedItemToLocal(item, {
                    sessionData: result.sessionData,
                    setsData: result.setsData,
                  });
                } catch {
                  localSaved = false;
                }
                setItems((prev) => prev.filter((i) => i.id !== item.id));
                Alert.alert(
                  '已接受',
                  localSaved ? '训练数据已添加到你的记录中。' : '云端已接受，本机记录将在下次同步后显示。',
                );
              } else {
                Alert.alert('操作失败', result.message || '请稍后重试。');
              }
            } catch {
              Alert.alert('操作失败', '请稍后重试。');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, [saveAcceptedItemToLocal]);

  const handleReject = useCallback(async (item: PendingTrainingItem) => {
    Alert.alert(
      '拒绝训练数据',
      '确定要拒绝这次训练数据吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '拒绝',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              const result = await rejectPendingTraining(item.id);
              if (result.ok) {
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              } else {
                Alert.alert('操作失败', result.message || '请稍后重试。');
              }
            } catch {
              Alert.alert('操作失败', '请稍后重试。');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const renderItem = (item: PendingTrainingItem) => {
    const isProcessing = processingId === item.id;
    const totalSets = item.setsData.length;
    const completedSets = item.setsData.filter((s) => s.completed).length;

    return (
      <AppCard key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Avatar
            name={item.uploader.nickname}
            size={40}
            uri={item.uploader.avatarUrl}
            variant="user"
          />
          <View style={styles.cardHeaderInfo}>
            <AppText variant="body" weight="700">
              {item.uploader.nickname}
            </AppText>
            <AppText variant="caption" tone="muted">
              为你记录了一次训练
            </AppText>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons color={colors.darkMuted} name="calendar-outline" size={14} />
            <AppText variant="caption" tone="muted">
              {item.sessionData.date}
            </AppText>
          </View>
          <View style={styles.detailRow}>
            <Ionicons color={colors.darkMuted} name="barbell-outline" size={14} />
            <AppText variant="caption" tone="muted">
              {completedSets}/{totalSets} 组已完成
            </AppText>
          </View>
          {item.sessionData.title ? (
            <View style={styles.detailRow}>
              <Ionicons color={colors.darkMuted} name="document-text-outline" size={14} />
              <AppText variant="caption" tone="muted">
                {item.sessionData.title}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <AppButton
            disabled={isProcessing}
            onPress={() => void handleAccept(item)}
            size="sm"
            style={styles.acceptButton}
          >
            {isProcessing ? <ActivityIndicator color={colors.background} size="small" /> : '接受'}
          </AppButton>
          <AppButton
            disabled={isProcessing}
            onPress={() => void handleReject(item)}
            size="sm"
            variant="ghost"
            style={styles.rejectButton}
          >
            拒绝
          </AppButton>
        </View>
      </AppCard>
    );
  };

  return (
    <Screen>
      <SecondaryPageHeader
        caption="训练数据"
        icon="cloud-upload-outline"
        subtitle="组员为你记录的训练数据，确认后将添加到你的记录中。"
        title="待确认数据"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="加载失败" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          description="当组员为你记录训练并上传后，数据会显示在这里。"
          title="暂无待确认数据"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {items.map(renderItem)}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardHeaderInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardDetails: {
    gap: spacing.xs,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
});
