import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppModalSheet } from '@/components/ui/AppModalSheet';
import { AppText } from '@/components/ui/AppText';
import { markAnnouncementRead, type Announcement } from '@/services/announcementService';

type AnnouncementModalProps = {
  announcement: Announcement;
  onClose: () => void;
  visible: boolean;
};

export function AnnouncementModal({ announcement, onClose, visible }: AnnouncementModalProps) {
  const [dismissing, setDismissing] = useState(false);

  async function handleClose() {
    if (dismissing) return;
    setDismissing(true);
    await markAnnouncementRead(announcement.id);
    setDismissing(false);
    onClose();
  }

  return (
    <AppModalSheet
      contentStyle={styles.content}
      footer={
        <AppButton disabled={dismissing} onPress={handleClose} variant="primary">
          我知道了
        </AppButton>
      }
      onClose={handleClose}
      position="center"
      subtitle="公告"
      title={announcement.title}
      visible={visible}
    >
      <ScrollView style={styles.scroll}>
        <AppText variant="body">{announcement.content}</AppText>
      </ScrollView>
    </AppModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: 320,
  },
  scroll: {
    flexGrow: 0,
  },
});
