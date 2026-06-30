import { ScrollView, StyleSheet } from 'react-native';

import { AppCard, AppText, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export default function TermsRoute() {
  return (
    <Screen>
      <ScrollView style={styles.container}>
        <AppCard style={styles.card}>
          <AppText variant="subtitle" weight="900">练刻 LiftMark 用户服务协议</AppText>
          <AppText tone="muted" variant="caption">更新日期：2026年6月26日</AppText>
          <AppText tone="muted" variant="caption">生效日期：2026年6月26日</AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">一、服务条款的接受</AppText>
          <AppText tone="muted" variant="bodySmall">
            欢迎使用练刻 LiftMark（以下简称“本应用”）。在使用本应用之前，请您仔细阅读并理解本用户服务协议（以下简称“本协议”）。一旦您开始使用本应用，即表示您已阅读、理解并同意受本协议的约束。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">二、服务内容</AppText>
          <AppText tone="muted" variant="bodySmall">
            练刻 LiftMark 是一款智能健身训练管理应用，提供以下核心服务：{'\n'}
            • 训练计划管理：创建、编辑、执行个性化训练计划{'\n'}
            • 训练记录：记录每次训练的详细数据{'\n'}
            • 进度分析：分析训练趋势和进步情况{'\n'}
            • 多人协作：支持团队成员共同训练{'\n'}
            • 数据导出：手动导出重要训练数据
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">三、账号注册与使用</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 您需要通过手机号注册账号才能使用完整功能{'\n'}
            • 您应提供真实、准确的注册信息{'\n'}
            • 您有责任妥善保管账号密码{'\n'}
            • 您不得将账号转让或出借给他人{'\n'}
            • 如发现账号被盗用，请立即联系我们
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">四、用户行为规范</AppText>
          <AppText tone="muted" variant="bodySmall">
            您在使用本应用时，应遵守以下规范：{'\n'}
            • 不得利用本应用进行任何违法活动{'\n'}
            • 不得上传或分享违法违规内容{'\n'}
            • 不得干扰或破坏本应用的正常运行{'\n'}
            • 不得未经授权访问其他用户的数据{'\n'}
            • 不得利用本应用从事商业推广活动（未经授权）
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">五、知识产权</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 本应用的所有知识产权归练刻团队所有{'\n'}
            • 您在本应用中创建的训练数据，知识产权归您所有{'\n'}
            • 您授予我们为提供服务所必需的数据使用权{'\n'}
            • 未经许可，您不得复制、修改、分发本应用的任何内容
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">六、免责声明</AppText>
          <AppText tone="muted" variant="bodySmall">
            • 本应用提供的训练建议仅供参考，不构成医疗建议{'\n'}
            • 使用本应用进行训练前，请咨询专业医师{'\n'}
            • 我们不对因使用本应用而造成的身体伤害承担责任{'\n'}
            • 我们会尽力保障服务稳定性，但不对服务中断承担责任{'\n'}
            • 数据备份义务由用户承担，建议定期导出重要数据
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">七、协议变更</AppText>
          <AppText tone="muted" variant="bodySmall">
            我们保留随时修改本协议的权利。修改后的协议将在应用内发布，并注明更新日期。继续使用本应用即表示您同意修改后的协议。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">八、争议解决</AppText>
          <AppText tone="muted" variant="bodySmall">
            本协议的解释和执行适用中华人民共和国法律。因本协议引起的争议，双方应友好协商解决；协商不成的，任何一方可向本应用运营方所在地人民法院提起诉讼。
          </AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="bodySmall" weight="900">九、联系我们</AppText>
          <AppText tone="muted" variant="bodySmall">
            如果您对本协议有任何疑问，请通过以下方式联系我们：{'\n'}
            邮箱：support@liftmark.app{'\n'}
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
