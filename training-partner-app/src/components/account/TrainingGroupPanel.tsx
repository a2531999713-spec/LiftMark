import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

import { AccountPanelRow } from './AccountPanelRow';

type TrainingGroupPanelProps = {
  activePlanName?: string;
  currentGroup?: Group | null;
  groups: Group[];
  members: GroupMember[];
  onCreateGroupPress: () => void;
  onGroupSettingsPress: () => void;
  onManageMembersPress: () => void;
  onSelectGroup: (groupId: string) => void;
};

export function TrainingGroupPanel({
  activePlanName,
  currentGroup,
  groups,
  members,
  onCreateGroupPress,
  onGroupSettingsPress,
  onManageMembersPress,
  onSelectGroup,
}: TrainingGroupPanelProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.currentCard}>
        <View style={styles.currentIcon}>
          <Ionicons color={colors.primary} name="people-outline" size={20} />
        </View>
        <View style={styles.currentText}>
          <AppText numberOfLines={1} variant="bodySmall" weight="900">
            {currentGroup?.name ?? '默认训练小组'}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {members.length} 位成员 · 当前计划：{activePlanName ?? '未设置'}
          </AppText>
        </View>
        <Tag label="当前" tone="brand" />
      </View>

      <View style={styles.section}>
        <AppText tone="muted" variant="caption" weight="900">
          小组列表
        </AppText>
        <View style={styles.groupList}>
          {groups.length === 0 ? (
            <AppText tone="muted" variant="bodySmall">
              还没有训练小组。
            </AppText>
          ) : null}
          {groups.map((group) => {
            const selected = group.id === currentGroup?.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={group.id}
                onPress={() => onSelectGroup(group.id)}
                style={({ pressed }) => [styles.groupRow, selected && styles.groupRowActive, pressed && styles.pressed]}
              >
                <View style={styles.groupText}>
                  <AppText numberOfLines={1} variant="bodySmall" weight="900">
                    {group.name}
                  </AppText>
                  <AppText numberOfLines={1} tone="muted" variant="caption">
                    第 {group.currentWeek} 周
                  </AppText>
                </View>
                {selected ? (
                  <Ionicons color={colors.primary} name="checkmark-circle" size={19} />
                ) : (
                  <AppText tone="muted" variant="caption" weight="900">
                    切换
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionCard}>
        <AccountPanelRow icon="people-circle-outline" label="管理成员" onPress={onManageMembersPress} />
        <View style={styles.divider} />
        <AccountPanelRow icon="add-circle-outline" label="创建小组" onPress={onCreateGroupPress} />
        <View style={styles.divider} />
        <AccountPanelRow icon="settings-outline" label="小组设置" onPress={onGroupSettingsPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  currentCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
  },
  currentIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  currentText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  groupList: {
    gap: spacing.xs,
  },
  groupRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  groupText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.78,
  },
  section: {
    gap: spacing.sm,
  },
  wrap: {
    gap: spacing.md,
  },
});
