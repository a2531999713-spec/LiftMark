import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SecondaryPageHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import type { PlanCycle, PlanDay, PlanTemplate } from '@/domain/plan/plan.types';
import type { TrainingReminder, TrainingReminderSettings } from '@/domain/reminder/trainingReminder.types';
import { getNotificationPermissionState, requestTrainingNotificationPermission, type NotificationPermissionState } from '@/services/notificationService';
import { defaultTrainingReminderSettings, readTrainingReminderSettings, saveTrainingReminderSettings, sendTrainingReminderTest } from '@/services/trainingReminderService';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];
const timeOptions = ['06:30', '07:00', '12:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

type ReminderContext = { group: Group; plan: PlanTemplate; cycle: PlanCycle; planDays: PlanDay[] };
function permissionLabel(state: NotificationPermissionState) { return state === 'granted' ? '已允许' : state === 'undetermined' ? '未请求' : '已拒绝'; }

export default function TrainingRemindersRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [context, setContext] = useState<ReminderContext | null>(null);
  const [settings, setSettings] = useState<TrainingReminderSettings>(defaultTrainingReminderSettings);
  const [reminders, setReminders] = useState<TrainingReminder[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [timeSheetOpen, setTimeSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await initializeLocalDatabase();
      const { group } = await resolveSelectedGroup(repositories.groupRepository, selectedGroupId);
      if (!group) { setContext(null); return; }
      if (group.id !== selectedGroupId) setSelectedGroupId(group.id);
      const plan = group.activePlanId ? await repositories.planRepository.getPlanById(group.activePlanId) : null;
      const cycle = plan ? await repositories.planRepository.getActivePlanCycle({ groupId: group.id, planId: plan.id }) : null;
      const planDays = plan ? await repositories.planRepository.listPlanDays(plan.id) : [];
      const nextReminders = await repositories.trainingReminderRepository.listByOwnerAndGroup(group.id);
      setContext(plan && cycle ? { group, plan, cycle, planDays } : null);
      setReminders(nextReminders); setSettings(readTrainingReminderSettings(nextReminders)); setPermission(await getNotificationPermissionState());
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '训练提醒加载失败。'); }
    finally { setLoading(false); }
  }, [repositories, selectedGroupId, setSelectedGroupId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toggleDay = (day: number) => setSettings((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day].sort() }));
  const save = async () => {
    if (!context) { setNotice('请先选择小组并启用一个当前训练计划。'); return; }
    setSaving(true); setNotice(null);
    try {
      if (settings.enabled && permission !== 'granted') {
        const nextPermission = await requestTrainingNotificationPermission(); setPermission(nextPermission);
        if (nextPermission !== 'granted') throw new Error('通知权限未开启，请在系统设置中允许练刻发送通知。');
      }
      await saveTrainingReminderSettings({ ...context, settings });
      setNotice(settings.enabled ? '训练提醒已保存并重新生成本机通知。' : '训练提醒已关闭，旧通知已取消。');
      await load();
    } catch (saveError) { setNotice(saveError instanceof Error ? saveError.message : '保存提醒失败。'); }
    finally { setSaving(false); }
  };
  const test = async () => {
    const reminder = reminders.find((item) => item.enabled);
    if (!reminder) { setNotice('请先保存并开启至少一种提醒方式。'); return; }
    try { await sendTrainingReminderTest(reminder); setNotice('测试通知已发送。'); } catch (testError) { setNotice(testError instanceof Error ? testError.message : '测试通知发送失败。'); }
  };
  const selectedPlanDays = context?.planDays.filter((day) => settings.weekdays.includes(day.weekday)) ?? [];

  return <Screen safeTop={false}>
    <SecondaryPageHeader caption="训练偏好" icon="notifications-outline" subtitle="按当前小组和计划，在本机生成训练提醒。" title="训练提醒" tag={settings.enabled ? '已开启' : '未开启'} />
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <EmptyState title="提醒暂时不可用" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}
    {!loading && !error ? <>
      <AppCard tone={settings.enabled ? 'brand' : 'soft'} style={styles.hero}>
        <View style={styles.iconCircle}><Ionicons color={colors.primary} name="notifications-outline" size={25} /></View>
        <View style={styles.grow}><AppText variant="subtitle" weight="900">训练提醒</AppText><AppText tone="muted" variant="caption">{settings.enabled ? `已开启 · ${settings.weekdays.map((day) => `周${weekdayLabels[day - 1]}`).join('、')} ${settings.remindTime}` : '未开启'}</AppText></View>
        <Switch trackColor={{ false: colors.borderStrong, true: colors.primary }} value={settings.enabled} onValueChange={(enabled) => setSettings((current) => ({ ...current, enabled }))} />
      </AppCard>
      <AppCard style={styles.card}><View style={styles.row}><View style={styles.grow}><AppText variant="bodySmall" weight="900">通知权限</AppText><AppText tone="muted" variant="caption">{permission === 'granted' ? '练刻可以在训练前提醒你。' : permission === 'denied' ? '通知已被系统拒绝。' : '首次开启提醒时再请求权限。'}</AppText></View><Tag label={permissionLabel(permission)} tone={permission === 'granted' ? 'success' : permission === 'denied' ? 'danger' : 'neutral'} /></View>{permission === 'denied' ? <AppButton variant="secondary" onPress={() => void Linking.openSettings()}>前往系统设置</AppButton> : null}</AppCard>
      {!context ? <EmptyState title="还不能设置提醒" description="请先选择小组，并为小组启用当前训练计划与周期。" actionLabel="管理计划" onActionPress={() => router.push('/(tabs)/plan' as never)} /> : <>
        <AppCard style={styles.card}><AppText variant="bodySmall" weight="900">训练日</AppText><AppText tone="muted" variant="caption">只会为当前计划已有的训练日创建提醒。</AppText><View style={styles.weekdays}>{weekdayLabels.map((label, index) => { const day = index + 1; const available = context.planDays.some((item) => item.weekday === day); const selected = settings.weekdays.includes(day); return <Pressable key={day} disabled={!available} onPress={() => toggleDay(day)} style={[styles.day, selected && styles.daySelected, !available && styles.dayDisabled]}><AppText style={selected ? styles.dayTextSelected : undefined} variant="caption" weight="900">{label}</AppText></Pressable>; })}</View>{selectedPlanDays.length === 0 ? <AppText tone="danger" variant="caption">请选择至少一个当前计划中的训练日。</AppText> : null}</AppCard>
        <AppCard style={styles.card}><AppText variant="bodySmall" weight="900">训练时间</AppText><Pressable onPress={() => setTimeSheetOpen(true)} style={styles.timeButton}><View><AppText tone="muted" variant="caption">计划开始时间</AppText><AppText variant="headline" weight="900">{settings.remindTime}</AppText></View><Ionicons color={colors.primary} name="time-outline" size={24} /></Pressable></AppCard>
        <AppCard style={styles.card}><AppText variant="bodySmall" weight="900">提醒方式</AppText>{([{ key: 'beforeThirtyMinutes', title: '提前 30 分钟', text: '准备装备，按计划开始。' }, { key: 'beforeTenMinutes', title: '提前 10 分钟', text: '打开练刻查看今天的训练内容。' }, { key: 'todayPlan', title: '当天计划提醒', text: '在训练开始时间提示今天的计划。' }] as const).map((item) => <View key={item.key} style={styles.row}><View style={styles.grow}><AppText variant="bodySmall" weight="900">{item.title}</AppText><AppText tone="muted" variant="caption">{item.text}</AppText></View><Switch trackColor={{ false: colors.borderStrong, true: colors.primary }} value={settings[item.key]} onValueChange={(value) => setSettings((current) => ({ ...current, [item.key]: value }))} /></View>)}</AppCard>
        <AppCard tone="soft" style={styles.card}><AppText variant="bodySmall" weight="900">测试提醒</AppText><AppText tone="muted" variant="caption">立即发送一条本机通知，用来确认权限和跳转。</AppText><AppButton icon="paper-plane-outline" variant="secondary" onPress={() => void test()}>发送测试通知</AppButton></AppCard>
        {notice ? <AppText tone={notice.includes('失败') || notice.includes('请') || notice.includes('未开启') ? 'danger' : 'success'} variant="bodySmall">{notice}</AppText> : null}
        <AppButton icon="checkmark-circle-outline" loading={saving} onPress={() => void save()}>{settings.enabled ? '保存并更新提醒' : '保存关闭状态'}</AppButton>
      </>}
    </> : null}
    <AppModalSheet visible={timeSheetOpen} onClose={() => setTimeSheetOpen(false)} title="选择训练时间" subtitle="选择最接近你通常开始训练的时间。"><View style={styles.times}>{timeOptions.map((time) => <Pressable key={time} onPress={() => { setSettings((current) => ({ ...current, remindTime: time })); setTimeSheetOpen(false); }} style={[styles.timeOption, settings.remindTime === time && styles.timeOptionSelected]}><AppText style={settings.remindTime === time ? styles.dayTextSelected : undefined} variant="bodySmall" weight="900">{time}</AppText></Pressable>)}</View></AppModalSheet>
  </Screen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md }, day: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, height: 38, justifyContent: 'center', width: 38 }, dayDisabled: { opacity: 0.35 }, daySelected: { backgroundColor: colors.primary }, dayTextSelected: { color: colors.surface }, grow: { flex: 1, gap: 3 }, hero: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, iconCircle: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, height: 48, justifyContent: 'center', width: 48 }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, timeButton: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md }, timeOption: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.sm }, timeOptionSelected: { backgroundColor: colors.primary }, times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, weekdays: { flexDirection: 'row', justifyContent: 'space-between' },
});
