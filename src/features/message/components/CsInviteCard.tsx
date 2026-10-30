import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showToast } from "@/shared/ui/app-toast";

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
        showToast(result.message);
        return;
      }
      markCsInviteClaimed(item.roomId, item.roomVersion, item.expireAt, false);
      showToast("接单成功，已进入房间");
    } finally {
      setClaiming(false);
    }
  }, [claiming, item.clubId, item.roomId, item.roomVersion, item.expireAt]);

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>接待邀请</Text>
        {canClaim ? (
          <Text style={styles.countdown}>剩余 {remainingSeconds} 秒</Text>
        ) : null}
      </View>
      <Text style={styles.subtitle}>{playerName} 请求接待</Text>
      <View style={styles.actionRow}>
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
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  cardDone: { opacity: 0.65 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  countdown: {
    color: "#FF8A9B",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 0,
  },
  subtitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    height: 26,
    minWidth: 72,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FE1F4C",
    backgroundColor: "#FFFFFF",
  },
  buttonPressed: { opacity: 0.78 },
  buttonText: {
    color: "#FE1F4C",
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
  },
});
