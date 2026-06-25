import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton } from '@/components/common/AppButton';
import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { MemberForm } from '@/components/members/MemberForm';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { MemberFormValues } from '@/domain/member/member.validation';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors } from '@/theme/colors';

function createInitialValues(member: GroupMember, profile: MemberProfile | null): MemberFormValues {
  return {
    displayName: member.displayName,
    bodyweight: profile?.bodyweight,
    bench1RM: profile?.bench1RM,
    squat1RM: profile?.squat1RM,
    deadlift1RM: profile?.deadlift1RM,
    overheadPress1RM: profile?.overheadPress1RM,
    pullupReferenceWeight: profile?.pullupReferenceWeight,
    barbellIncrement: profile?.barbellIncrement ?? 2.5,
    dumbbellIncrement: profile?.dumbbellIncrement ?? 2,
  };
}

export default function MemberDetailRoute() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [member, setMember] = useState<GroupMember | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMember() {
      if (!memberId) {
        setError('缺少成员 ID。');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await initializeLocalDatabase();
        const group = await repositories.groupRepository.getDefaultGroup();
        if (!group) {
          throw new Error('默认小组尚未初始化。');
        }

        const members = await repositories.memberRepository.listMembers(group.id);
        const nextMember = members.find((candidate) => candidate.id === memberId);
        if (!nextMember) {
          throw new Error('未找到该成员。');
        }

        const nextProfile = await repositories.memberRepository.getMemberProfile(nextMember.id);

        if (isMounted) {
          setMember(nextMember);
          setProfile(nextProfile);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : '成员加载失败。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMember();

    return () => {
      isMounted = false;
    };
  }, [memberId, repositories]);

  const handleSubmit = useCallback(
    async (values: MemberFormValues) => {
      if (!member) {
        return;
      }

      if (!guardFeature('start_workout')) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const nextMember = await repositories.memberRepository.updateMember(member.id, {
          displayName: values.displayName.trim(),
        });
        const nextProfile = await repositories.memberRepository.updateProfile(member.id, {
          bodyweight: values.bodyweight,
          bench1RM: values.bench1RM,
          squat1RM: values.squat1RM,
          deadlift1RM: values.deadlift1RM,
          overheadPress1RM: values.overheadPress1RM,
          pullupReferenceWeight: values.pullupReferenceWeight,
          barbellIncrement: values.barbellIncrement,
          dumbbellIncrement: values.dumbbellIncrement,
        });

        setMember(nextMember);
        setProfile(nextProfile);
        router.replace('/(tabs)/members');
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '成员更新失败。');
      } finally {
        setIsSaving(false);
      }
    },
    [guardFeature, member, repositories],
  );

  return (
    <Screen
      title={member ? member.displayName : '成员资料'}
      subtitle="修改个人参数不会改变既有训练历史。"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="成员资料出错" description={error} /> : null}

      {!isLoading && member ? (
        <MemberForm
          initialValues={createInitialValues(member, profile)}
          isSubmitting={isSaving}
          onSubmit={handleSubmit}
          submitLabel="保存成员"
        />
      ) : null}

      {!isLoading && !member ? (
        <AppButton onPress={() => router.replace('/(tabs)/members')} variant="secondary">
          返回成员
        </AppButton>
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}
