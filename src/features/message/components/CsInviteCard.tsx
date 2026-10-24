import { HeadphonesRegular } from "@fluentui/react-native-icons";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-root-toast";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { CsInviteCardMessage } from "../chat-message";
import {
  getCsInviteClaimState,
  markCsInviteClaimed,
  markCsInviteUnclaimed,
  subscribeCsInviteClaimState,
} from "../cs-invite-claim-state";
import { claimAndEnterCustomerServiceRoom } from "@/features/voice-room/use-customer-service-room-flow";

export const CsInviteCard = memo(function CsInviteCard({ item }: { item: CsInviteCardMessage }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [, bumpVersion] = useState(0);

  useEffect(() => subscribeCsInviteClaimState(() => bumpVersion((tick) => tick + 1)), []);

  const remainingSeconds = item.expireAt
    ? Math.max(0, Math.ceil(item.expireAt - nowMs / 1000))
    : 0;
  const claimState = getCsInviteClaimState(item.roomId, item.roomVersion, item.expireAt);
  const claimed = Boolean(claimState?.claimed);
  const enterPending = Boolean(claimState?.enterPending);
  const canClaim = !claimed && remainingSeconds > 0;
  const canEnterClaimed = claimed && enterPending;
  const done = !canClaim && !canEnterClaimed;
  const statusHint = claimed ? "已接单" : "邀请已过期";

  // 倒计时只在可接单期间运行；归零后 canClaim 翻转触发最终渲染
  useEffect(() => {
    if (!canClaim) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [canClaim]);

  const playerName = useMemo(
    () => item.playerName || (item.playerUserId ? `玩家${item.playerUserId}` : "玩家"),
    [item.playerName, item.playerUserId],
  );

  const handleClaim = useCallback(async (resumed: boolean) => {
    if (claiming) return;
    setClaiming(true);
    try {
      const result = await claimAndEnterCustomerServiceRoom(
        { roomId: item.roomId, clubId: item.clubId, roomVersion: item.roomVersion },
        resumed,
      );
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        markCsInviteUnclaimed(item.roomId, item.roomVersion, item.expireAt);
        Toast.show(result.message, { duration: Toast.durations.SHORT });
        return;
      }
      markCsInviteClaimed(item.roomId, item.roomVersion, item.expireAt, false);
      Toast.show("接单成功，已进入房间", { duration: Toast.durations.SHORT });
    } finally {
      setClaiming(false);
    }
  }, [claiming, item.clubId, item.roomId, item.roomVersion, item.expireAt]);

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.iconWrap}>
        <HeadphonesRegular color="#FE1F4C" width={20} height={20} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>接待邀请</Text>
          {canClaim ? (
            <Text style={styles.countdown}>剩余 {remainingSeconds} 秒</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.sub}>
          {playerName} 请求接待
        </Text>
      </View>
      {canClaim || canEnterClaimed ? (
        <Pressable
          accessibilityLabel={canEnterClaimed ? "进入房间" : "接单"}
          accessibilityRole="button"
          disabled={claiming}
          onPress={() => {
            void handleClaim(canEnterClaimed);
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{canEnterClaimed ? "进入房间" : "接单"}</Text>
        </Pressable>
      ) : (
        <Text style={styles.status}>{statusHint}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  cardDone: { opacity: 0.65 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE6EB",
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  countdown: {
    color: "#FF8A9B",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  sub: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
  },
  buttonPressed: { opacity: 0.78 },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  status: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 0,
  },
});
