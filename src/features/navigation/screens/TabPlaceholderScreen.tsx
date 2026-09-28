import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function TabPlaceholderScreen({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.screen}><View style={{ paddingTop: insets.top }}><Text style={styles.title}>{title}</Text></View><View style={styles.empty}><Text style={styles.emptyText}>{title}功能即将上线</Text></View></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F7F7" }, title: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 20, fontWeight: "600", color: "#0A0A0A" }, empty: { flex: 1, alignItems: "center", justifyContent: "center" }, emptyText: { color: "#999", fontSize: 13 }, });
