import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { EmptyState, Screen, SecondaryPageHeader } from '@/components/ui';
import { MemberForm } from '@/components/members/MemberForm';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { MemberFormValues } from '@/domain/member/member.validation';
import { canAddGroupMember, MAX_GROUP_MEMBERS } from '@/domain/member/member.validation';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors } from '@/theme/colors';

export default function NewMemberRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoading(true);
      setError(null);

      try {
        await initializeLocalDatabase();
        const groups = await repositories.groupRepository.listGroups();
        const currentGroup = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
        if (!currentGroup) {
          throw new Error('默认小组尚未初始化。');
        }
        if (currentGroup.id !== selectedGroupId) {
          setSelectedGroupId(currentGroup.id);
        }

        const members = await repositories.memberRepository.listMembers(currentGroup.id);
        if (isMounted) {
          setGroup(currentGroup);
          setMemberCount(members.length);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : '成员表单准备失败。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      isMounted = false;
    };
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  const handleSubmit = useCallback(
    async (values: MemberFormValues) => {
      if (!group) {
        return;
      }

      if (!guardFeature('add_member', { memberCount })) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await repositories.memberRepository.createMember({
          groupId: group.id,
          displayName: values.displayName.trim(),
          profile: {
            bodyweight: values.bodyweight,
            bench1RM: values.bench1RM,
            squat1RM: values.squat1RM,
            deadlift1RM: values.deadlift1RM,
            overheadPress1RM: values.overheadPress1RM,
            pullupReferenceWeight: values.pullupReferenceWeight,
            barbellIncrement: values.barbellIncrement,
            dumbbellIncrement: values.dumbbellIncrement,
          },
        });

        router.replace(returnTo === 'settings' ? '/settings/members' : '/(tabs)/members');
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '成员保存失败。');
      } finally {
        setIsSaving(false);
      }
    },
    [group, guardFeature, memberCount, repositories, returnTo],
  );

  const canCreateMember = canAddGroupMember(memberCount);

  return (
    <Screen>
      <SecondaryPageHeader
        caption="小组成员"
        icon="person-add-outline"
        meta={`${memberCount}/${MAX_GROUP_MEMBERS}`}
        subtitle="创建训练搭子，并保存常用训练参数。"
        title="新增成员"
      />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="成员表单出错" description={error} /> : null}

      {!isLoading && !canCreateMember ? (
        <EmptyState
          title={`本地小组最多支持 ${MAX_GROUP_MEMBERS} 位训练成员`}
          description="适合一台设备多人轮换记录。多设备小组能力后续版本开放。"
        />
      ) : null}

      {!isLoading && group && canCreateMember ? (
        <MemberForm isSubmitting={isSaving} onSubmit={handleSubmit} submitLabel="保存成员" />
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}
