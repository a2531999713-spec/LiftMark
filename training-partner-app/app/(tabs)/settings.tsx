import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentProps, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import { exportLocalDataJson, resetDefaultPlanData } from '@/services/exportService';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfileRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      await initializeLocalDatabase();
      const [nextGroup, nextMembers] = await Promise.all([
        repositories.groupRepository.getDefaultGroup(),
        repositories.memberRepository.listMembers('default'),
      ]);
      setGroup(nextGroup);
      setMembers(nextMembers);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  const handleExport = useCallback(async () => {
    try {
      const json = await exportLocalDataJson();
      setNotice({ title: '数据已导出', message: json.slice(0, 200) + '...' });
    } catch {
      setNotice({ title: '导出失败', message: '请稍后重试。' });
    }
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert('重置默认计划', '将补齐缺失的 seed 数据，不会删除训练记录。', [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'destructive', onPress: () => void resetDefaultPlanData() },
    ]);
  }, []);

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/about' as never)} style={styles.aboutButton}>
          <Ionicons color={colors.textMuted} name="information-circle-outline" size={20} />
        </Pressable>
      }
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading ? (
        <>
          <AppCard style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Ionicons color={colors.primary} name="barbell-outline" size={24} />
              </View>
              <View style={styles.profileInfo}>
                <AppText variant="subtitle" weight="700">练刻 LiftMark</AppText>
                <AppText tone="muted" variant="caption">v{Constants.expoConfig?.version ?? '0.1.0'}</AppText>
              </View>
            </View>
          </AppCard>

          <Section title="训练设置">
            <AppCard style={styles.groupCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/settings/member-units')}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="barbell-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">加重单位</AppText>
                  <AppText tone="muted" variant="caption">按成员设置杠铃/哑铃加重单位</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>
            </AppCard>
          </Section>

          <Section title="成员管理">
            <AppCard style={styles.groupCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/settings/members')}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="people-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">训练成员</AppText>
                  <AppText tone="muted" variant="caption">
                    {members.length > 0 ? `${members.length} 位成员` : '添加训练伙伴'}
                  </AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setNotice({ title: '本地小组', message: '当前版本的小组适合同一台设备多人轮换记录，数据保存在本机。' })}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="information-circle-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">本地小组规则</AppText>
                  <AppText tone="muted" variant="caption">了解小组数据存储方式</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>
            </AppCard>
          </Section>

          <Section title="数据管理">
            <AppCard style={styles.groupCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleExport()}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="download-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">导出全部数据</AppText>
                  <AppText tone="muted" variant="caption">导出 JSON 格式</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setNotice({ title: '导入计划', message: '选择 .liftmark.json 文件导入训练计划。' })}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="cloud-upload-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">导入计划</AppText>
                  <AppText tone="muted" variant="caption">选择文件导入</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => void handleReset()}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="reload-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">重置默认计划</AppText>
                  <AppText tone="muted" variant="caption">补齐缺失 seed，不删除训练记录</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>
            </AppCard>
          </Section>

          <Section title="关于">
            <AppCard style={styles.groupCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/about' as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="information-circle-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">关于练刻</AppText>
                  <AppText tone="muted" variant="caption">版本信息与开源协议</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/activation' as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons color={colors.primary} name="key-outline" size={18} />
                </View>
                <View style={styles.itemText}>
                  <AppText variant="bodySmall" weight="600">输入激活码</AppText>
                  <AppText tone="muted" variant="caption">激活完整功能</AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>
            </AppCard>
          </Section>
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
    </Screen>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="subtitle">{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  aboutButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  profileCard: {
    padding: spacing.lg,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: spacing.sm,
  },
  groupCard: {
    gap: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
  },
  item: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  itemIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.82,
  },
});
