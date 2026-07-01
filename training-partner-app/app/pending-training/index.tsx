import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen, SecondaryPageHeader } from '@/components/ui';
import { AppButton, AppCard, AppText, EmptyState } from '@/components/ui';
import {
  acceptPendingTraining,
  getPendingTrainingItems,
  rejectPendingTraining,
  type PendingTrainingItem,
} from '@/services/pendingTrainingService';
import { colors, radius, spacing } from '@/theme';

export default function PendingTrainingRoute() {
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
    void loadItems();
  }, [loadItems]);

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
                setItems((prev) => prev.filter((i) => i.id !== item.id));
                Alert.alert('已接受', '训练数据已添加到你的记录中。');
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
