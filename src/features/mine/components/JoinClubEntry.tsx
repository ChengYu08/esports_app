import { fetchClubJoinState } from "@/features/mine/api/club-join.api";
import { useClubJoinRefresh } from "@/features/mine/hooks/use-club-join-refresh";
import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

export const clubJoinStateKey = (token: string | null) =>
  ["club-join", "state", token] as const;

export function JoinClubEntry() {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: clubJoinStateKey(token),
    queryFn: () => fetchClubJoinState(token as string),
    enabled: Boolean(token && user?.id && !user.clubInfo?.id),
  });
  useClubJoinRefresh(query.refetch);

  if (!token || !user || user.clubInfo?.id) {
    return null;
  }
  const label =
    query.data?.status === "APPROVED"
      ? "申请已通过"
      : query.data?.status === "PENDING"
        ? "申请待审核"
        : query.data?.status === "REJECTED"
          ? "申请被拒绝"
          : "加入俱乐部";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push("/join-club")}
      style={styles.button}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E9E9EB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  text: { color: "#0D0D0F", fontSize: 14, fontWeight: "500", lineHeight: 22 },
});
