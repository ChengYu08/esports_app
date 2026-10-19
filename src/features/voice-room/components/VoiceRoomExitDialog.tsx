import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  isOwner: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function VoiceRoomExitDialog({ visible, isOwner, pending, error, onCancel, onConfirm }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => { if (!pending) onCancel(); }}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>{isOwner ? '解散房间提醒' : '退出房间提醒'}</Text>
            <Text style={styles.message}>
              {isOwner ? '确定解散当前语聊房吗？解散后其他访客也将退出房间。' : '确定退出当前语聊房吗？退出后将断开语音连接。'}
            </Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={onCancel}
              style={[styles.button, styles.cancelButton, pending && styles.disabled]}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pending ? '处理中' : '确定'}
              accessibilityState={{ busy: pending, disabled: pending }}
              disabled={pending}
              onPress={onConfirm}
              style={[styles.button, styles.confirmButton, pending && styles.disabled]}
            >
              {pending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmText}>确定</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  dialog: { width: 295, maxWidth: '100%', marginTop: -24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  content: { padding: 16, gap: 12 },
  title: { color: '#333333', fontSize: 16, fontWeight: '600', lineHeight: 24, textAlign: 'center' },
  message: { color: '#666666', fontSize: 14, lineHeight: 22 },
  error: { color: '#FE1F4C', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  button: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  cancelButton: { borderWidth: 1, borderColor: '#FE1F4C' },
  confirmButton: { backgroundColor: '#FE1F4C' },
  cancelText: { color: '#FE1F4C', fontSize: 14, fontWeight: '600', lineHeight: 22 },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', lineHeight: 22 },
  disabled: { opacity: 0.6 },
});
