import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { Club } from "@/features/home/api/home.types";

const icons = {
  user: require("../../../../assets/home/h_user.svg"),
  id: require("../../../../assets/home/h_id.svg"),
};

export function ClubCard({ club }: { club: Club }) {
  const colors = ["#24354b", "#4a2637", "#2e4650", "#493e2e"];
  const hue = colors[Number(club.id.match(/\d+$/)?.[0] ?? 0) % 4];

  return (
    <Pressable style={styles.club} onPress={() => undefined}>
      <View style={[styles.cover, { backgroundColor: hue }]}>
        <Text style={styles.coverText}>{club.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {club.isSelfOperated && <Text style={styles.self}>自营</Text>}
          <Text numberOfLines={1} style={styles.name}>{club.name}</Text>
          <Text style={styles.online}>• {club.onlineCount}人</Text>
        </View>
        <Text numberOfLines={2} style={styles.desc}>{club.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}><Image source={icons.user} style={styles.metaIcon} /> {club.memberCount}人</Text>
          <Text style={styles.meta}><Image source={icons.id} style={styles.metaIcon} /> {club.clubCode}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  club: { minHeight: 104, marginHorizontal: 16, flexDirection: "row", gap: 12 },
  cover: { width: 84, height: 84, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  coverText: { fontFamily: DOUYIN_SANS, color: "rgba(255,255,255,.78)", fontSize: 34, fontWeight: "800" },
  body: { flex: 1, paddingTop: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 22 },
  self: { fontFamily: DOUYIN_SANS, color: "#fff", backgroundColor: "#ff1f4c", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, fontSize: 10, fontWeight: "700" },
  name: { fontFamily: DOUYIN_SANS, color: "#0a0a0a", fontSize: 14, fontWeight: "500", flexShrink: 1 },
  online: { fontFamily: DOUYIN_SANS, color: "#2fc273", fontSize: 12 },
  desc: { fontFamily: DOUYIN_SANS, color: "#666", fontSize: 12, lineHeight: 18, marginTop: 3 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  meta: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 11 },
  metaIcon: { width: 12, height: 12 },
});
