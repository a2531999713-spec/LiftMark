import { StyleSheet, View } from 'react-native';

import { AppCard, AppText, Screen, SecondaryPageHeader } from '@/components/ui';
import { spacing } from '@/theme';

type LegalDraftPageProps = {
  kind: 'privacy' | 'terms';
};

const privacySections = [
  {
    title: '我们收集哪些数据',
    body: '当前版本会保存账号昵称、手机号登录状态、头像、本地小组、训练计划、训练记录、身体数据和必要的设备运行信息。训练记录优先保存在当前设备。'
  },
  {
    title: '数据如何保存',
    body: '训练现场数据会写入本机数据库；登录态和少量账号资料会保存在本机安全存储或本机缓存。后续云同步开启时，会按用户操作上传需要同步的数据。'
  },
  {
    title: '本地数据与云同步',
    body: '当前云同步仍在逐步开放中。未同步的数据以本机保存为准；服务器不可用时，不会阻止用户继续训练和记录。'
  },
  {
    title: '用户如何导出和删除',
    body: '当前版本提供计划导出和基础数据入口。完整训练数据导出、账号注销和云端删除流程会在正式上线前补齐。'
  },
  {
    title: '账号与会员',
    body: '手机号用于登录、注册和账号安全校验。会员状态仅用于展示和控制对应权益，不会改变本机已保存的训练记录。'
  },
  {
    title: '联系与反馈',
    body: '如果需要反馈隐私问题，请通过“设置与反馈”入口提交。正式上线前会补充完整联系方式和处理流程。'
  },
];

const termsSections = [
  {
    title: '服务内容',
    body: '练刻 LiftMark 提供训练计划执行、小组训练记录、历史查看、头像和账号资料等功能。部分云同步、备份和会员能力仍在开发中。'
  },
  {
    title: '训练风险提示',
    body: '应用提供训练记录和计划执行工具，不构成医疗建议。用户应根据自身情况训练，必要时咨询专业人士。'
  },
  {
    title: '账号使用',
    body: '用户应妥善保管手机号、密码和验证码。退出登录不会删除本机训练记录。'
  },
  {
    title: '数据归属与导出',
    body: '用户在应用中记录的训练数据归用户使用和管理。当前版本会逐步补齐更完整的数据导出、备份和删除能力。'
  },
  {
    title: '会员与激活码',
    body: '会员与激活码入口用于展示和兑换账号权益。未完成的购买、支付或续费能力不会在本草案中承诺。'
  },
  {
    title: '协议更新',
    body: '本页面当前为草案，正式上线前会补充完整条款、适用主体、联系方式和必要的合规信息。'
  },
];

export function LegalDraftPage({ kind }: LegalDraftPageProps) {
  const isPrivacy = kind === 'privacy';
  const sections = isPrivacy ? privacySections : termsSections;
  const title = isPrivacy ? '隐私政策' : '用户协议';

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="法务与支持"
        icon={isPrivacy ? 'shield-checkmark-outline' : 'document-text-outline'}
        subtitle="当前为草案，正式上线前需补充完整协议内容。"
        tag="草案"
        title={title}
      />

      <AppCard style={styles.notice} tone="brand">
        <AppText variant="bodySmall" weight="900">
          当前为草案
        </AppText>
        <AppText tone="muted" variant="caption">
          本页面用于保留入口和信息结构，正式上线前需要补充完整协议内容。
        </AppText>
      </AppCard>

      <View style={styles.sections}>
        {sections.map((section) => (
          <AppCard key={section.title} style={styles.card}>
            <AppText variant="bodySmall" weight="900">
              {section.title}
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              {section.body}
            </AppText>
          </AppCard>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  notice: {
    gap: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  sections: {
    gap: spacing.md,
  },
});
