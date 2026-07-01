import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen, SecondaryPageHeader } from '@/components/ui';
import { AppButton, AppCard, AppText, EmptyState } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember } from '@/domain/member/member.types';
import { uploadPendingTraining } from '@/services/pendingTrainingService';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';

export default function UploadMembersRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const user = useAuthStore((state) => state.user);
  const repositories = useMemo(() => createLocalRepositories(), []);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMembers() {
      if (!sessionId) return;
      setIsLoading(true);
      try {
        await initializeLocalDatabase();
        const detail = await repositories.workoutRepository.getSessionDetail(sessionId);
        const allMembers = await repositories.memberRepository.listMembers(detail.session.groupId);
        // 排除当前用户（自己）
        const otherMembers = allMembers.filter((m) => m.displayName !== user?.displayName);
        if (isMounted) {
          setMembers(otherMembers);
        }
      } catch {
        if (isMounted) {
          setError('加载成员失败。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMembers();
    return () => { isMounted = false; };
  }, [sessionId, repositories, user]);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (!sessionId || selectedMemberIds.size === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      const detail = await repositories.workoutRepository.getSessionDetail(sessionId);
      let success = 0;
      let failed = 0;

      for (const memberId of selectedMemberIds) {
        const member = members.find((m) => m.id === memberId);
        if (!member) {
          failed++;
          continue;
        }

        // 获取该成员的训练组数据
        const memberSets = detail.sets.filter((s) => s.memberId === memberId);
        if (memberSets.length === 0) {
          failed++;
          continue;
        }

        const result = await uploadPendingTraining({
          groupId: detail.session.groupId,
          targetUserId: memberId, // 这里需要用真实的 user_id，本地成员暂用 memberId
          sessionData: {
            title: detail.session.title,
            date: detail.session.date,
            week: detail.session.week,
            weekday: detail.session.weekday,
            status: 'completed',
          },
          setsData: memberSets.map((set) => ({
            exerciseId: set.exerciseRecordId,
            setNumber: set.setNumber,
            weight: set.actualWeight ?? set.plannedWeight,
            reps: set.actualReps ?? set.plannedReps,
            completed: set.completed,
            skipped: set.skipped,
            rpe: set.rpe,
            notes: set.notes,
          })),
        });

        if (result.ok) {
          success++;
        } else {
          failed++;
        }
      }

      setUploadResult({ success, failed });
    } catch {
      setError('上传失败，请稍后重试。');
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, selectedMemberIds, members, repositories]);

  if (uploadResult) {
    return (
      <Screen>
        <View style={styles.resultContainer}>
          <Ionicons
            color={uploadResult.failed === 0 ? colors.success : colors.warning}
            name={uploadResult.failed === 0 ? 'checkmark-circle' : 'alert-circle'}
            size={64}
          />
          <AppText variant="headline" weight="900">
            上传完成
          </AppText>
          <AppText variant="body" tone="muted">
            成功：{uploadResult.success} 人
            {uploadResult.failed > 0 ? `，失败：${uploadResult.failed} 人` : ''}
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.resultHint}>
            被上传的组员登录后会收到确认提示。
          </AppText>
          <AppButton onPress={() => router.replace('/(tabs)/today')} style={styles.doneButton}>
            完成
          </AppButton>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SecondaryPageHeader
        caption="上传数据"
        icon="cloud-upload-outline"
        subtitle="选择要上传训练数据的组员，他们登录后可以确认接受。"
        title="选择组员"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="加载失败" description={error} />
      ) : members.length === 0 ? (
        <EmptyState
          description="本次训练没有其他组员参与。"
          title="无其他组员"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {members.map((member) => {
            const isSelected = selectedMemberIds.has(member.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => toggleMember(member.id)}
                style={[styles.memberCard, isSelected && styles.memberCardSelected]}
              >
                <Avatar
                  name={member.displayName}
                  size={44}
                  uri={member.avatarUrl}
                  variant="user"
                />
                <AppText variant="body" weight="600" style={styles.memberName}>
                  {member.displayName}
                </AppText>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && (
                    <Ionicons color={colors.background} name="checkmark" size={16} />
                  )}
                </View>
              </Pressable>
            );
          })}

          <AppButton
            disabled={isUploading || selectedMemberIds.size === 0}
            onPress={() => void handleUpload()}
            style={styles.uploadButton}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              `上传到 ${selectedMemberIds.size} 位组员`
            )}
          </AppButton>

          <AppButton
            onPress={() => router.replace('/(tabs)/today')}
            style={styles.skipButton}
            variant="ghost"
          >
            跳过，只上传我的数据
          </AppButton>
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
  memberCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  memberCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  memberName: {
    flex: 1,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  uploadButton: {
    marginTop: spacing.md,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
  resultContainer: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  resultHint: {
    textAlign: 'center',
  },
  doneButton: {
    marginTop: spacing.lg,
    minWidth: 200,
  },
});
