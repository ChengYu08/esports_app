import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-root-toast";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { markCsInviteClaimed, markCsInviteUnclaimed } from "@/features/message/cs-invite-claim-state";
import { claimAndEnterCustomerServiceRoom } from "../use-customer-service-room-flow";
import { useCsInviteBar } from "../cs-invite-bar-store";
import { releaseCsInviteKey } from "./ReceptionCommandListener";

const TAB_BAR_HEIGHT = 58;
const MIN_BAR_DURATION_MS = 2000;

const tradeNoticeIcon = require("../../../../assets/svgs/cs-invite-trade-notice.svg");
const arrowRightIcon = require("../../../../assets/svgs/cs-invite-arrow-right.svg");

function CsInviteBarImpl({ visible }: { visible?: boolean }) {
  const insets = useSafeAreaInsets();
  const invite = useCsInviteBar((state) => state.invite);
  const dismiss = useCsInviteBar((state) => state.dismiss);
  const [claiming, setClaiming] = useState(false);

  // 到期自动消失；最少展示 2 秒，防止刚弹出就被过期数据收走
  useEffect(() => {
    if (!invite) return;
    const remainMs = invite.expireAt * 1000 - Date.now();
    const timer = setTimeout(dismiss, Math.max(remainMs, MIN_BAR_DURATION_MS));
    return () => {
      clearTimeout(timer);
      // 条已消失（到期/接单成功/被新邀请替换），释放去重键允许下一轮邀请再次提示
      releaseCsInviteKey(invite.key);
    };
  }, [invite, dismiss]);

  if (!invite || !visible) return null;

  const playerName = invite.playerName
    || (invite.playerUserId ? `玩家${invite.playerUserId}` : "玩家");

  const handleGrab = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const result = await claimAndEnterCustomerServiceRoom({
        roomId: invite.roomId,
        clubId: invite.clubId,
        roomVersion: invite.roomVersion,
      });
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        markCsInviteUnclaimed(invite.roomId, invite.roomVersion, invite.expireAt);
        Toast.show(result.message, { duration: Toast.durations.SHORT });
        return;
      }
      markCsInviteClaimed(invite.roomId, invite.roomVersion, invite.expireAt, false);
      dismiss();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}
    >
      <View style={styles.shadow}>
        <LinearGradient
          colors={["#2F2759", "#231E4B", "#0C0C2E"]}
          end={{ x: 0.996, y: 0.565 }}
          locations={[0.004, 0.805, 1]}
          start={{ x: 0.004, y: 0.435 }}
          style={styles.bar}
        >
          <View style={styles.info}>
            <Image contentFit="contain" source={tradeNoticeIcon} style={styles.icon} />
            <Text numberOfLines={1} style={styles.text}>
              {playerName} 请求接待
            </Text>
          </View>
          <Pressable
            accessibilityLabel="去抢单"
            accessibilityRole="button"
            disabled={claiming}
            hitSlop={8}
            onPress={() => {
              void handleGrab();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionText}>去抢单</Text>
            <Image contentFit="contain" source={arrowRightIcon} style={styles.icon} />
          </Pressable>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export const CsInviteBar = CsInviteBarImpl;

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  shadow: {
    borderRadius: 43,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 43,
    overflow: "hidden",
  },
  info: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 16,
    height: 16,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  actionPressed: { opacity: 0.78 },
  actionText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
});
