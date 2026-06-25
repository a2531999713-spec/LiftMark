import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppModalSheet, AppText, EmptyState, Screen } from '@/components/ui';
import {
  LogoutButton,
  ProfileHeader,
  ProfileHeroCard,
  ProfileMenuItem,
  ProfileSection,
} from '@/components/profile';
import { createLocalRepositories, getDatabase, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import {
  checkServerHealth,
  getInitialServerStatus,
  type ServerConnectionStatus,
} from '@/services/serverStatusService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

type Diagnostics = {
  databaseVersion: number;
  exerciseCount: number;
  seedStatus: string;
  sqliteStatus: string;
};

type CountRow = {
  count: number;
};

async function loadDiagnostics(): Promise<Diagnostics> {
  await initializeLocalDatabase();
  const db = await getDatabase();
  const exerciseCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM exercises');
  const planCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM plan_templates');
  const migration = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );

  return {
    databaseVersion: migration?.version ?? 0,
    exerciseCount: exerciseCount?.count ?? 0,
    seedStatus: (exerciseCount?.count ?? 0) > 0 && (planCount?.count ?? 0) > 0 ? '已初始化' : '待初始化',
    sqliteStatus: '已连接',
  };
}

function getMemberSummary(member: GroupMember | null, profile: MemberProfile | null) {
  if (!member) {
    return '还没有训练身份';
  }

  const bodyweight = profile?.bodyweight ? `${profile.bodyweight} kg` : '体重未设置';
  const bench = profile?.bench1RM ? `卧推 ${profile.bench1RM} kg` : '1RM 待补充';
  return `${member.displayName} · ${bodyweight} · ${bench}`;
}

function getAuthModeLabel(
  authMode: ReturnType<typeof useAuthStore.getState>['authMode'],
  authStatus: ReturnType<typeof useAuthStore.getState>['authStatus'],
) {
  if (authStatus === 'offline_authenticated') return '本机模式';
  if (authMode === 'logged_in_lifetime') return '永久会员';
  if (authMode === 'logged_in_pro') return 'Pro';
  if (authMode === 'logged_in_free') return '免费版';
  return '未登录';
}

export default function SettingsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const {
    authMode,
    authStatus,
    isLoggedIn,
    isLoading: isAuthLoading,
    loadCurrentUser,
    logout,
    user,
  } = useAuthStore();
  const { guardFeature, sheets } = useAuthGate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesByMemberId, setProfilesByMemberId] = useState<Record<string, MemberProfile | null>>({});
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [developerTapCount, setDeveloperTapCount] = useState(0);
  const [isDeveloperMode, setDeveloperMode] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerConnectionStatus>(() => getInitialServerStatus());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMember = members[0] ?? null;
  const currentProfile = currentMember ? (profilesByMemberId[currentMember.id] ?? null) : null;

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      await loadCurrentUser();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const nextMembers = await repositories.memberRepository.listMembers(nextGroup.id);
      const profiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );

      setGroup(nextGroup);
      setMembers(nextMembers);
      setProfilesByMemberId(Object.fromEntries(profiles));
      if (isDeveloperMode) {
        setDiagnostics(await loadDiagnostics());
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '我的页面加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [isDeveloperMode, loadCurrentUser, repositories]);

  const refreshServerStatus = useCallback(async () => {
    setServerStatus((current) => ({ ...current, status: 'checking', message: '检测中' }));
    setServerStatus(await checkServerHealth());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void refreshServerStatus();
    }, [loadProfile, refreshServerStatus]),
  );

  const showDeveloping = useCallback((title = '功能开发中') => {
    setNotice({ title, message: '该功能正在开发中，后续版本开放。' });
  }, []);

  const confirmLogout = useCallback(() => {
    Alert.alert('确定退出当前账号？', '退出后，当前设备上的本地数据仍会保留。未同步的数据请确认已经备份。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  }, [logout]);

  const confirmAccountDeletion = useCallback(() => {
    Alert.alert('注销账号并处理相关数据？', '账号注销需要单独确认。当前版本后端接口尚未接入，不会静默删除任何本机训练数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '注销账号',
        style: 'destructive',
        onPress: () => showDeveloping('账号注销'),
      },
    ]);
  }, [showDeveloping]);

  const handleVersionPress = useCallback(() => {
    if (isDeveloperMode) {
      return;
    }

    const nextCount = developerTapCount + 1;
    setDeveloperTapCount(nextCount);
    if (nextCount >= 7) {
      setDeveloperMode(true);
      void loadDiagnostics().then(setDiagnostics).catch(() => undefined);
      setNotice({ title: '开发者模式已开启', message: '开发与诊断信息已显示在页面底部。' });
    }
  }, [developerTapCount, isDeveloperMode]);

  return (
    <Screen contentStyle={styles.screen}>
      <ProfileHeader
        actions={[
          {
            dot: true,
            icon: 'notifications-outline',
            label: '通知',
            onPress: () => showDeveloping('通知'),
          },
          {
            icon: 'settings-outline',
            label: '设置',
            onPress: () => router.push('/profile/preferences' as never),
          },
        ]}
        subtitle="你的力量训练计划执行器"
        title="我的"
      />

      {isLoading || isAuthLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? (
        <EmptyState
          actionLabel="重新加载"
          description="请重试"
          onActionPress={() => void loadProfile()}
          title="数据加载失败"
        />
      ) : null}

      {!isLoading && !error ? (
        <>
          <ProfileHeroCard
            currentMember={currentMember}
            group={group}
            isLoggedIn={isLoggedIn}
            onLogin={() => router.push('/account/login' as never)}
            onPress={() => router.push((isLoggedIn ? '/account' : '/account/login') as never)}
            user={user}
          />

          {!currentMember ? (
            <EmptyState
              actionLabel="创建训练身份"
              description="创建训练身份后，可以计算建议重量并记录训练。"
              onActionPress={() => {
                if (guardFeature('add_member', { memberCount: members.length })) {
                  router.push('/member/new' as never);
                }
              }}
              title="还没有训练身份"
            />
          ) : null}

          {!group ? (
            <EmptyState
              actionLabel="创建小组"
              description="创建小组后，可以和搭子一起执行同一个训练计划。"
              onActionPress={() => {
                if (guardFeature('create_group', { groupCount: group ? 1 : 0 })) {
                  showDeveloping('创建小组');
                }
              }}
              title="还没有训练小组"
            />
          ) : null}

          <ProfileSection icon="barbell-outline" title="训练相关">
            <ProfileMenuItem
              description={getMemberSummary(currentMember, currentProfile)}
              icon="id-card-outline"
              label="我的训练身份"
              onPress={() => {
                if (isLoggedIn || guardFeature('add_member', { memberCount: members.length })) {
                  router.push('/profile/training-identity' as never);
                }
              }}
              trailing={currentMember ? '查看' : '创建'}
            />
            <ProfileMenuItem
              description="成员管理、权限设置、邀请管理"
              icon="people-outline"
              label="我的小组"
              onPress={() => {
                if (isLoggedIn || guardFeature('create_group', { groupCount: group ? 1 : 0 })) {
                  router.push('/profile/groups' as never);
                }
              }}
              trailing={members.length > 0 ? `${members.length} 成员` : '创建'}
            />
            <ProfileMenuItem
              description="单位、记录方式、休息计时等"
              icon="options-outline"
              label="训练偏好"
              onPress={() => router.push('/profile/preferences' as never)}
              trailing="kg"
            />
          </ProfileSection>

          <ProfileSection icon="shield-checkmark-outline" title="账号与服务">
            <ProfileMenuItem
              description={
                isLoggedIn
                  ? user?.phone ?? user?.email ?? user?.displayName ?? '已登录账号'
                  : '登录后可保存训练记录、开启云同步并恢复数据'
              }
              icon="person-circle-outline"
              label={isLoggedIn ? '当前账号' : '当前未登录'}
              onPress={() => router.push((isLoggedIn ? '/account' : '/account/login') as never)}
              tag={getAuthModeLabel(authMode, authStatus)}
            />
            <ProfileMenuItem
              description={serverStatus.baseUrl}
              icon="server-outline"
              label="服务器连接"
              onPress={() => void refreshServerStatus()}
              tag={
                serverStatus.status === 'online'
                  ? '已连接'
                  : serverStatus.status === 'checking'
                    ? '检测中'
                    : '离线'
              }
              trailing={
                serverStatus.status === 'online' && serverStatus.latencyMs
                  ? `${serverStatus.latencyMs} ms`
                  : undefined
              }
            />
            <ProfileMenuItem
              description="手机号、邮箱、密码与登录设备"
              icon="lock-closed-outline"
              label="账号安全"
              onPress={() => {
                if (isLoggedIn) {
                  router.push('/account/security' as never);
                } else {
                  guardFeature('activate_code');
                }
              }}
              tag={isLoggedIn ? undefined : '未登录'}
            />
            <ProfileMenuItem
              description="云同步开发中 / 可测试"
              icon="cloud-outline"
              label="云同步"
              onPress={() => {
                if (guardFeature('cloud_sync')) router.push('/profile/sync' as never);
              }}
              tag="可测试"
            />
            <ProfileMenuItem
              description="权益、激活码、购买记录"
              icon="diamond-outline"
              label="会员与激活"
              onPress={() => router.push('/profile/membership' as never)}
            />
          </ProfileSection>

          <ProfileSection icon="settings-outline" title="通用设置">
            <ProfileMenuItem
              description="跟随系统"
              icon="contrast-outline"
              label="外观与主题"
              onPress={() => showDeveloping('外观与主题')}
              trailing="跟随系统"
            />
            <ProfileMenuItem
              description="消息、提醒、训练提示等"
              icon="notifications-outline"
              label="通知设置"
              onPress={() => showDeveloping('通知设置')}
            />
            <ProfileMenuItem
              description="简体中文"
              icon="language-outline"
              label="语言"
              onPress={() => showDeveloping('语言')}
              trailing="简体中文"
            />
            <ProfileMenuItem
              description="清理临时缓存"
              icon="file-tray-outline"
              label="缓存管理"
              onPress={() => showDeveloping('缓存管理')}
            />
          </ProfileSection>

          <ProfileSection icon="finger-print-outline" title="数据与隐私">
            <ProfileMenuItem
              description="训练数据可见范围"
              icon="eye-off-outline"
              label="隐私设置"
              onPress={() => router.push('/profile/privacy' as never)}
            />
            <ProfileMenuItem
              description="清空本机数据、删除云端数据"
              icon="trash-outline"
              label="数据删除"
              onPress={() => router.push('/profile/privacy' as never)}
              tag="需确认"
            />
            <ProfileMenuItem
              danger
              description="注销账号并处理相关数据"
              icon="person-remove-outline"
              label="账号注销"
              onPress={confirmAccountDeletion}
            />
          </ProfileSection>

          <ProfileSection icon="help-circle-outline" title="帮助与关于">
            <ProfileMenuItem
              description="使用帮助、意见反馈、常见问题"
              icon="chatbubble-ellipses-outline"
              label="帮助与反馈"
              onPress={() => showDeveloping('帮助与反馈')}
            />
            <ProfileMenuItem
              description="版本信息、用户协议、隐私政策"
              icon="information-circle-outline"
              label="关于练刻"
              onPress={() => router.push('/about' as never)}
              trailing={Constants.expoConfig?.version ?? '0.1.0'}
            />
            <ProfileMenuItem
              description="查看协议"
              icon="document-text-outline"
              label="用户协议"
              onPress={() => showDeveloping('用户协议')}
            />
            <ProfileMenuItem
              description="查看隐私政策"
              icon="document-lock-outline"
              label="隐私政策"
              onPress={() => showDeveloping('隐私政策')}
            />
          </ProfileSection>

          {isLoggedIn ? <LogoutButton disabled={isAuthLoading} onPress={confirmLogout} /> : null}

          {isDeveloperMode ? (
            <ProfileSection icon="terminal-outline" title="开发者诊断">
              <ProfileMenuItem
                description="隐藏入口，仅开发者模式显示"
                icon="server-outline"
                label="SQLite 状态"
                trailing={diagnostics?.sqliteStatus ?? '未知'}
              />
              <ProfileMenuItem
                icon="git-branch-outline"
                label="数据库版本"
                trailing={`${diagnostics?.databaseVersion ?? 0}`}
              />
              <ProfileMenuItem
                icon="leaf-outline"
                label="seed 状态"
                trailing={diagnostics?.seedStatus ?? '未知'}
              />
              <ProfileMenuItem
                icon="fitness-outline"
                label="动作数量"
                trailing={`${diagnostics?.exerciseCount ?? 0}`}
              />
            </ProfileSection>
          ) : null}

          <Pressable accessibilityRole="button" onPress={handleVersionPress} style={styles.versionFooter}>
            <View style={styles.versionBrand}>
              <Ionicons color={colors.primary} name="flash-outline" size={18} />
              <AppText variant="bodySmall" weight="900">
                练刻 LiftMark
              </AppText>
            </View>
            <AppText tone="muted" variant="caption">
              Version {Constants.expoConfig?.version ?? '0.1.0'}
            </AppText>
          </Pressable>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  screen: {
    gap: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  versionBrand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  versionFooter: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
