import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, SectionHeader, Tag } from '@/components/ui';
import { formatProgressionSuggestionLabel } from '@/domain/progression/progression.labels';
import type { ProgressionSuggestion } from '@/domain/progression/progression.types';
import { colors, radius, spacing } from '@/theme';

type Props = {
  emptyDescription?: string;
  exerciseNames: Record<string, string>;
  isGenerating?: boolean;
  memberNames: Record<string, string>;
  onRetry?: () => void;
  suggestions: ProgressionSuggestion[];
};

function suggestionTone(suggestion: ProgressionSuggestion['suggestion']) {
  if (suggestion === 'increase' || suggestion === 'add_reps') return 'success' as const;
  if (suggestion === 'decrease' || suggestion === 'deload' || suggestion === 'maintain_or_decrease') return 'warning' as const;
  return 'neutral' as const;
}

export function ProgressionSuggestionList({
  emptyDescription = '完成更多有效训练组后，系统会生成下一次训练建议。',
  exerciseNames,
  isGenerating = false,
  memberNames,
  onRetry,
  suggestions,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const grouped = suggestions.reduce<Record<string, ProgressionSuggestion[]>>((groups, suggestion) => {
    groups[suggestion.memberId] = [...(groups[suggestion.memberId] ?? []), suggestion];
    return groups;
  }, {});

  return (
    <AppCard style={styles.card}>
      <SectionHeader subtitle="基于本次已记录的组数、次数和重量自动计算。" title="下次训练建议" />
      {isGenerating ? (
        <View style={styles.statusRow}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={20} />
          <AppText tone="muted" variant="bodySmall">正在生成下次建议…</AppText>
        </View>
      ) : null}
      {!isGenerating && suggestions.length === 0 ? (
        <EmptyState
          actionLabel={onRetry ? '重新生成' : undefined}
          description={emptyDescription}
          onActionPress={onRetry}
          title="暂未生成建议"
        />
      ) : null}
      {Object.entries(grouped).map(([memberId, memberSuggestions]) => (
        <View key={memberId} style={styles.memberGroup}>
          <AppText variant="bodySmall" weight="900">{memberNames[memberId] ?? '成员'}</AppText>
          {memberSuggestions.map((suggestion) => {
            const isExpanded = expandedIds.has(suggestion.id);
            return (
              <View key={suggestion.id} style={styles.row}>
                <View style={styles.copy}>
                  <AppText variant="bodySmall" weight="900">{exerciseNames[suggestion.exerciseId] ?? '训练动作'}</AppText>
                  {suggestion.suggestedWeight !== undefined ? (
                    <AppText tone="brand" variant="caption">建议重量：{suggestion.suggestedWeight} kg</AppText>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(suggestion.id)) next.delete(suggestion.id); else next.add(suggestion.id);
                      return next;
                    })}
                  >
                    <AppText numberOfLines={isExpanded ? undefined : 2} tone="muted" variant="caption">
                      {suggestion.reason}
                    </AppText>
                  </Pressable>
                </View>
                <Tag label={formatProgressionSuggestionLabel(suggestion.suggestion)} tone={suggestionTone(suggestion.suggestion)} />
              </View>
            );
          })}
        </View>
      ))}
      <AppText tone="subtle" variant="caption">
        进阶建议基于已记录的组数、次数和重量自动计算，仅供训练安排参考。身体不适或动作质量下降时，应优先降低强度。
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  memberGroup: { gap: spacing.sm },
  row: { alignItems: 'flex-start', backgroundColor: colors.backgroundElevated, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  statusRow: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
});
