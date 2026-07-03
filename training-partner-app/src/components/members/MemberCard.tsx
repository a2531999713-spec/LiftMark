import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { describeOneRmStatus } from '@/domain/member/member.service';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type MemberCardProps = {
  member: GroupMember;
  profile: MemberProfile | null;
  onPress: () => void;
};

export function MemberCard({ member, profile, onPress }: MemberCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Avatar
          avatarLocalUri={profile?.avatarLocalUri}
          avatarThumbUrl={profile?.avatarThumbUrl}
          avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
          name={member.displayName}
          size={44}
        />
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{member.displayName}</Text>
            <View style={[styles.badge, member.memberType === 'real' ? styles.badgeReal : styles.badgeLocal]}>
              <Text style={styles.badgeText}>{member.memberType === 'real' ? '真实成员' : '本地成员'}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {describeOneRmStatus(profile)}
            {profile?.bodyweight ? ` · 体重 ${profile.bodyweight}kg` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{'›'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.sizes.subtitle,
    fontWeight: '800',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badgeLocal: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeReal: {
    backgroundColor: colors.successSoft,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: typography.sizes.caption,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.sizes.bodySmall,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: typography.sizes.title,
  },
});
