import { Flag24Regular, PersonProhibited24Regular } from "@fluentui/react-native-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SYSTEM_FONT } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";

type CircleMoreActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onExited: () => void;
  onReport: () => void;
  onBlock: () => void;
};

export function CircleMoreActionsSheet({
  visible,
  onClose,
  onExited,
  onReport,
  onBlock,
}: CircleMoreActionsSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onExited={onExited}
      contentStyle={styles.sheet}
    >
      <View style={styles.handle} />
      <Pressable
        accessibilityLabel="举报"
        accessibilityRole="button"
        onPress={onReport}
        style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      >
        <Flag24Regular color="#333333" height={24} width={24} />
        <Text style={styles.actionLabel}>举报</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        accessibilityLabel="拉黑"
        accessibilityRole="button"
        onPress={onBlock}
        style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      >
        <PersonProhibited24Regular color="#333333" height={24} width={24} />
        <Text style={styles.actionLabel}>拉黑</Text>
      </Pressable>
      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: "#D9D9D9",
  },
  actionRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  actionRowPressed: { opacity: 0.6 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
    backgroundColor: "#EEEEEE",
  },
  actionLabel: {
    marginLeft: 12,
    fontFamily: SYSTEM_FONT,
    color: "#222222",
    fontSize: 16,
  },
});
