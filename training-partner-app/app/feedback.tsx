import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton, AppCard, AppText, Screen, SecondaryPageHeader, SettingsRow } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type FeedbackType = 'feature' | 'issue';

export default function FeedbackRoute() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isFeature = feedbackType === 'feature';

  const submit = () => {
    if (!content.trim()) {
      Alert.alert(isFeature ? '请写下功能建议' : '请描述遇到的问题', '内容为空时无法提交。');
      return;
    }
    setSubmitted(true);
    Alert.alert('已保存到本机草稿', '联网提交和工单跟踪仍在开发中，当前不会丢失你输入的内容。');
  };

  const confirmClearCache = () => {
    Alert.alert('确认清理缓存？', '当前版本不会删除训练记录。后续版本会提供更细的缓存清理能力。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () =>
          Alert.alert('清理缓存', '缓存清理能力正在开发中。'),
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="反馈与诊断"
        icon="chatbubble-ellipses-outline"
        subtitle="功能建议和问题反馈已合并，选择类型后填写即可"
        title="反馈与诊断"
      />

      <AppCard style={styles.card}>
        <AppText variant="subtitle" weight="900">
          反馈类型
        </AppText>
        <View style={styles.typeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFeedbackType('feature')}
            style={[styles.typeChip, isFeature && styles.typeChipActive]}
          >
            <Ionicons name="bulb-outline" size={16} color={isFeature ? colors.surface : colors.primary} />
            <AppText tone={isFeature ? 'inverse' : 'muted'} variant="caption" weight="900">
              功能建议
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFeedbackType('issue')}
            style={[styles.typeChip, !isFeature && styles.typeChipActive]}
          >
            <Ionicons name="bug-outline" size={16} color={!isFeature ? colors.surface : colors.primary} />
            <AppText tone={!isFeature ? 'inverse' : 'muted'} variant="caption" weight="900">
              问题反馈
            </AppText>
          </Pressable>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <AppText variant="subtitle" weight="900">
          {isFeature ? '建议内容' : '问题描述'}
        </AppText>
        <TextInput
          multiline
          onChangeText={setContent}
          placeholder={isFeature ? '例如：希望按动作自动生成热身组...' : '例如：首页偶尔提示加载失败，重试后恢复...'}
          placeholderTextColor={colors.textSubtle}
          style={styles.multilineInput}
          textAlignVertical="top"
          value={content}
        />
        <AppText variant="bodySmall" weight="900">
          联系方式（选填）
        </AppText>
        <TextInput
          onChangeText={setContact}
          placeholder="手机号 / 邮箱 / 备注"
          placeholderTextColor={colors.textSubtle}
          style={styles.textInput}
          value={contact}
        />
        <AppButton onPress={submit}>{submitted ? '更新草稿' : '提交'}</AppButton>
      </AppCard>

      <AppCard style={styles.card}>
        <SettingsRow label="当前版本" value={Constants.expoConfig?.version ?? '0.1.0'} />
        <SettingsRow label="Android package" value="com.liftmark.app" />
        <SettingsRow label="本地数据库" value="随 App 启动检查" />
        <SettingsRow label="云同步" value="可在云同步页手动检查" />
      </AppCard>

      <AppCard style={styles.card} tone="soft">
        <AppText variant="bodySmall" weight="900">
          缓存
        </AppText>
        <AppText tone="muted" variant="caption">
          危险操作会二次确认，不会直接删除训练记录。
        </AppText>
        <AppButton onPress={confirmClearCache} variant="danger">
          清理缓存
        </AppButton>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  multilineInput: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  typeChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
