import { ScrollView, StyleSheet } from 'react-native';

import { AppCard, AppText, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export default function PrivacyPolicyRoute() {
  return (
    <Screen>
      <ScrollView style={styles.container}>
        <AppCard style={styles.card}>
          <AppText variant="subtitle" weight="900">练刻 LiftMark 隐私政策</AppText>
          <AppText tone="muted" variant="caption">更新日期：2026年6月26日</AppText>
          <AppText tone="muted" variant="caption">生效日期：2026年6月26日</AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">一、引言</AppText>
          <AppText tone="muted" variant="bodySmall">
            练刻 LiftMark（以下简称“我们”或“本应用”）非常重视用户的隐私保护。本隐私政策适用于您使用练刻 LiftMark 应用及相关服务时我们对您个人信息的收集、使用、存储和保护。
          </AppText>
          <AppText tone="muted" variant="bodySmall">
            请您在使用本应用前仔细阅读本隐私政策。如果您不同意本政策的任何条款，请停止使用本应用。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">二、我们收集的信息</AppText>
          <AppText tone="muted" variant="bodySmall" weight="700">2.1 您主动提供的信息</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 手机号：用于账号注册、登录和验证码验证{'\n'}
            • 昵称：用于在应用内显示您的身份{'\n'}
            • 训练数据：包括训练计划、训练记录、身体数据等，用于提供训练分析服务
          </AppText>
          <AppText tone="muted" variant="bodySmall" weight="700">2.2 自动收集的信息</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 设备信息：设备型号、操作系统版本、唯一设备标识符{'\n'}
            • 日志信息：应用崩溃日志、性能数据{'\n'}
            • 网络信息：网络类型、IP 地址（仅用于安全防护）
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">三、我们如何使用信息</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 提供核心服务：训练计划管理、训练记录、数据分析{'\n'}
            • 账号管理：注册、登录、密码找回{'\n'}
            • 安全防护：防范欺诈、账号盗用{'\n'}
            • 服务改进：分析使用情况，优化产品体验{'\n'}
            • 客户支持：响应您的咨询和反馈
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">四、信息存储与保护</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 设备存储：训练数据优先存储在您的当前设备中{'\n'}
            • 账号资料：登录后用于保存账号资料和会员权益{'\n'}
            • 加密保护：所有传输数据使用 TLS 加密，敏感信息使用 AES 加密存储{'\n'}
            • 访问控制：严格的权限管理，仅授权人员可访问用户数据{'\n'}
            • 数据备份：建议通过导出功能定期备份重要训练数据
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">五、信息共享</AppText>
          <AppText tone="muted" variant="bodySmall">
            我们不会向第三方出售、出租或交换您的个人信息。仅在以下情况下可能共享：{'\n'}
            • 获得您的明确同意{'\n'}
            • 法律法规要求{'\n'}
            • 保护本应用及其用户的合法权益{'\n'}
            • 与授权服务商合作（如短信服务、云服务），这些服务商受严格的保密协议约束
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">六、您的权利</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 查看权：您可随时查看您的个人信息{'\n'}
            • 更正权：您可更正不准确的个人信息{'\n'}
            • 删除权：您可删除账号及所有相关数据{'\n'}
            • 导出权：您可导出您的训练数据{'\n'}
            • 撤回同意：您可随时撤回对信息收集的同意{'\n'}
            • 注销账号：您可在设置中申请注销账号
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">七、未成年人保护</AppText>
          <AppText tone="muted" variant="bodySmall">
            我们非常重视未成年人隐私保护。如果您是未满 18 周岁的未成年人，请在法定监护人的指导下使用本应用。我们不会主动收集未成年人的个人信息。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">八、政策更新</AppText>
          <AppText tone="muted" variant="bodySmall">
            我们可能会不时更新本隐私政策。更新后的政策将在应用内发布，并注明更新日期。重大变更时，我们将通过应用通知或弹窗告知您。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">九、联系我们</AppText>
          <AppText tone="muted" variant="bodySmall">
            如果您对本隐私政策有任何疑问，请通过以下方式联系我们：{'\n'}
            邮箱：privacy@liftmark.app{'\n'}
            我们将在 15 个工作日内回复您的请求。
          </AppText>
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    gap: spacing.sm,
  },
});
