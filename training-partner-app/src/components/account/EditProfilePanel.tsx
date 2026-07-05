import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import type { AvatarPickSource } from '@/services/avatar';
import { colors, radius, spacing, typography } from '@/theme';

export type AccountGender = 'female' | 'male' | 'other' | 'unspecified';

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
  phoneMasked?: string;
  syncLabel: string;
};

const genderOptions: { label: string; value: AccountGender }[] = [
  { label: '未设置', value: 'unspecified' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
];

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
  phoneMasked,
  syncLabel,
}: EditProfilePanelProps) {
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
      <View style={styles.avatarRow}>
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
        <View style={styles.avatarText}>
          <AppText variant="bodySmall" weight="900">
            点击头像直接更换
          </AppText>
          <AppText tone="muted" variant="caption">
            账号头像会同步到当前账号绑定的训练成员。
          </AppText>
        </View>
      </View>

      <View style={styles.fieldCard}>
        <FieldLabel label="昵称" />
        <TextInput
          maxLength={16}
          onChangeText={(displayName) => onDraftChange({ ...draft, displayName })}
          placeholder="练刻用户"
          placeholderTextColor={colors.textSubtle}
          style={styles.textInput}
          value={draft.displayName}
        />
      </View>

      <View style={styles.twoColumn}>
        <View style={[styles.fieldCard, styles.flexField]}>
          <FieldLabel label="年龄" />
          <TextInput
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(ageText) => onDraftChange({ ...draft, ageText: ageText.replace(/[^\d]/g, '') })}
            placeholder="未设置"
            placeholderTextColor={colors.textSubtle}
            style={styles.textInput}
            value={draft.ageText}
          />
        </View>
        <View style={[styles.fieldCard, styles.flexField]}>
          <FieldLabel label="性别" />
          <View style={styles.genderGrid}>
            {genderOptions.map((option) => {
              const active = draft.gender === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => onDraftChange({ ...draft, gender: option.value })}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                >
                  <AppText
                    numberOfLines={1}
                    style={active ? styles.genderTextActive : styles.genderText}
                    variant="caption"
                    weight="900"
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.readonlyCard}>
        <ReadonlyRow label="手机号" value={phoneMasked ?? '未设置'} />
        <ReadonlyRow label="练刻 ID" value={liftmarkId ?? '未设置'} />
        <ReadonlyRow label="会员" value={membershipLabel} />
        <ReadonlyRow label="云同步" value={syncLabel} />
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

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readonlyRow}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="caption" weight="900">
        {value}
      </AppText>
    </View>
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
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  flexField: {
    flex: 1,
  },
  genderChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  genderChipActive: {
    backgroundColor: colors.primary,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  genderText: {
    color: colors.textMuted,
  },
  genderTextActive: {
    color: colors.surface,
  },
  readonlyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  readonlyRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
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
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrap: {
    gap: spacing.sm,
  },
});
