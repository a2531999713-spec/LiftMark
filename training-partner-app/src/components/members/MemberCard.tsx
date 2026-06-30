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
          <Text style={styles.name}>{member.displayName}</Text>
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
    fontSize: typography.sizes.subtitle,
    fontWeight: '800',
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
