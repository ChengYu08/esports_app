import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function CompanionDashboardHeader({
  title,
  onSave,
  saveDisabled = false,
  saving = false,
}: {
  title: string;
  onSave?: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, height: insets.top + 44 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回"
        disabled={saving}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)/mine")
        }
        style={styles.side}
      >
        <ChevronLeft24Regular width={24} height={24} color="#0A0A0A" />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {onSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存"
          disabled={saveDisabled || saving}
          onPress={onSave}
          style={styles.side}
        >
          <Text style={[styles.save, saveDisabled && styles.disabled]}>
            {saving ? "保存中" : "保存"}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center" },
  side: {
    width: 56,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  save: { color: "#0A0A0A", fontSize: 14, lineHeight: 22 },
  disabled: { color: "#CCC" },
});
