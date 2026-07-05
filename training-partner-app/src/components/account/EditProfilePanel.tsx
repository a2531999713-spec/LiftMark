import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import type { AvatarPickSource } from '@/services/avatar';
import { colors, radius, spacing, typography } from '@/theme';

export type AccountGender = 'female' | 'male' | 'other' | 'hidden' | 'unspecified';

export type EditProfileDraft = {
  ageText: string;
  displayName: string;
  gender: AccountGender;
};

type EditProfilePanelProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  draft: EditProfileDraft;
  isAvatarWorking?: boolean;
  liftmarkId?: string;
  membershipLabel: string;
  onAvatarPick: (source: AvatarPickSource) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
  onDraftChange: (draft: EditProfileDraft) => void;
  onMembershipPress: () => void;
  onSyncPress: () => void;
  phoneMasked?: string;
  syncLabel: string;
};

const genderOptions: { label: string; value: AccountGender }[] = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
  { label: '不展示', value: 'hidden' },
];

const genderLabels: Record<AccountGender, string> = {
  female: '女',
  hidden: '不展示',
  male: '男',
  other: '其他',
  unspecified: '选择性别',
};

export function EditProfilePanel({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  draft,
  isAvatarWorking = false,
  liftmarkId,
  membershipLabel,
  onAvatarPick,
  onAvatarRemove,
  onDraftChange,
  onMembershipPress,
  onSyncPress,
  phoneMasked,
  syncLabel,
}: EditProfilePanelProps) {
  const [isGenderOpen, setGenderOpen] = useState(false);

  const openAvatarActions = () => {
    Alert.alert('头像', '选择头像操作', [
      { text: '从相册选择', onPress: () => void onAvatarPick('library') },
      { text: '拍照', onPress: () => void onAvatarPick('camera') },
      { text: '移除头像', onPress: () => void onAvatarRemove(), style: 'destructive' },
      { text: '取消', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.identityCard}>
        <Pressable accessibilityRole="button" onPress={openAvatarActions} style={styles.avatarButton}>
          <Avatar
            avatarLocalUri={avatarLocalUri}
            avatarThumbUrl={avatarThumbUrl}
            avatarUrl={avatarUrl}
            name={draft.displayName}
            size={58}
          />
          <View style={styles.avatarBadge}>
            {isAvatarWorking ? (
              <Ionicons color={colors.surface} name="hourglass-outline" size={13} />
            ) : (
              <Ionicons color={colors.surface} name="camera-outline" size={13} />
            )}
          </View>
        </Pressable>

        <View style={styles.identityText}>
          <TextInput
            maxLength={16}
            onChangeText={(displayName) => onDraftChange({ ...draft, displayName })}
            placeholder="练刻用户"
            placeholderTextColor={colors.textSubtle}
            style={styles.nameInput}
            value={draft.displayName}
          />
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {phoneMasked ?? '手机号未绑定'}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {liftmarkId ? `LiftMark ID: ${liftmarkId}` : 'LiftMark ID 未生成'}
          </AppText>
        </View>
      </View>

      <View style={styles.fieldCard}>
        <FieldLabel label="年龄" />
        <TextInput
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={(ageText) => onDraftChange({ ...draft, ageText: ageText.replace(/[^\d]/g, '') })}
          placeholder="设置年龄"
          placeholderTextColor={colors.textSubtle}
          style={styles.textInput}
          value={draft.ageText}
        />
      </View>

      <View style={styles.genderCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setGenderOpen((current) => !current)}
          style={styles.genderRow}
        >
          <View>
            <AppText tone="muted" variant="caption" weight="900">
              性别
            </AppText>
            <AppText variant="bodySmall" weight="900">
              {genderLabels[draft.gender]}
            </AppText>
          </View>
          <Ionicons
            color={colors.textSubtle}
            name={isGenderOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
          />
        </Pressable>
        {isGenderOpen ? (
          <View style={styles.genderOptions}>
            {genderOptions.map((option) => {
              const active = draft.gender === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => {
                    onDraftChange({ ...draft, gender: option.value });
                    setGenderOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.genderOption,
                    active && styles.genderOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText
                    style={active ? styles.genderTextActive : styles.genderText}
                    variant="caption"
                    weight="900"
                  >
                    {option.label}
                  </AppText>
                  {active ? <Ionicons color={colors.surface} name="checkmark" size={15} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.readonlyCard}>
        <ReadonlyActionRow label="会员状态" onPress={onMembershipPress} value={membershipLabel} />
        <View style={styles.readonlyDivider} />
        <ReadonlyActionRow label="云同步状态" onPress={onSyncPress} value={syncLabel} />
      </View>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <AppText tone="muted" variant="caption" weight="900">
      {label}
    </AppText>
  );
}

function ReadonlyActionRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.readonlyRow, pressed && styles.pressed]}>
      <AppText tone="muted" variant="caption" weight="900">
        {label}
      </AppText>
      <View style={styles.readonlyValue}>
        <AppText numberOfLines={1} variant="caption" weight="900">
          {value}
        </AppText>
        <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: -1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 24,
  },
  avatarButton: {
    position: 'relative',
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  genderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  genderOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  genderOptionActive: {
    backgroundColor: colors.primary,
  },
  genderOptions: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.md,
  },
  genderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  genderText: {
    color: colors.textMuted,
  },
  genderTextActive: {
    color: colors.surface,
  },
  identityCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 86,
    padding: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameInput: {
    color: colors.textStrong,
    fontSize: typography.sizes.subtitle,
    fontWeight: '900',
    minHeight: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.82,
  },
  readonlyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  readonlyDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  readonlyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  readonlyValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 160,
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: typography.sizes.body,
    fontWeight: '800',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  wrap: {
    gap: spacing.sm,
  },
});
