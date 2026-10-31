import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  applyGrabSelection,
  resolveMaxSelectableCount,
  type QuickMatchGrabItem,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { useMatchSelectAndPay } from "@/features/match/hooks/use-match-select-and-pay";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchPaySheet } from "@/features/match/components/MatchPaySheet";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { showToast } from "@/shared/ui/app-toast";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

type MatchSelectAndPaySheetProps = {
  visible: boolean;
  requestNo: string;
  /** 活动模式判定与 activityId 来源（activityCode 非空即活动单选）；普通派单传 null 走多选 */
  detail: QuickMatchRequestDetail | null;
  candidates: QuickMatchGrabItem[];
  token: string | null;
  /** 关闭选人弹窗（建单成功弹出支付面板前会先调用） */
  onClose: () => void;
  /** 支付成功（参数为选中陪玩对应的订单 id，可能为 null） */
  onPaid: (orderId: string | null) => void;
};

/**
 * 可复用「选人 + 建单 + 支付」弹窗单元：
 * 语聊房「派单匹配中」按钮（任务 4）等容器直接传入 requestNo/detail/candidates 拉起。
 * 选人规则与匹配中页一致：活动模式单选（maxSelectableCount），普通模式 3 人多选。
 */
export function MatchSelectAndPaySheet({
  visible,
  requestNo,
  detail,
  candidates,
  token,
  onClose,
  onPaid,
}: MatchSelectAndPaySheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedGrabIds, setSelectedGrabIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 每次打开重置选人，避免上一次会话的选中残留（render 阶段派生重置）
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setSelectedGrabIds([]);
    }
  }

  const toggleGrab = useCallback(
    (grabId: string) => {
      const maxSelectable = resolveMaxSelectableCount(detail);
      const result = applyGrabSelection(selectedGrabIds, grabId, maxSelectable);
      setSelectedGrabIds(result.ids);
      if (result.overLimit) {
        showToast(`最多选择${maxSelectable}名陪玩`);
      }
    },
    [detail, selectedGrabIds],
  );

  const selectAndPay = useMatchSelectAndPay({
    requestNo,
    token,
    detail,
    candidates,
    selectedGrabIds,
    submitting,
    setSubmitting,
    onPaid,
  });

  // 建单成功弹出支付面板时，先收起选人弹窗
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (selectAndPay.paySheetProps.visible) {
      onCloseRef.current();
    }
  }, [selectAndPay.paySheetProps.visible]);

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        dismissOnBackdropPress={!submitting}
        contentStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        <Text style={styles.title}>选择陪玩</Text>
        <View style={styles.list}>
          {candidates.map((item) => {
            const selected = selectedGrabIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleGrab(item.id)}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <Text style={styles.nickname} numberOfLines={1}>
                  {item.nickname}
                </Text>
                {item.remark ? (
                  <Text style={styles.remark} numberOfLines={1}>
                    {item.remark}
                  </Text>
                ) : null}
                <View style={[styles.check, selected && styles.checkSelected]} />
              </Pressable>
            );
          })}
          {candidates.length === 0 ? (
            <Text style={styles.empty}>暂无陪玩抢单，请稍候…</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="确认下单"
          disabled={submitting}
          onPress={selectAndPay.handleConfirm}
          style={({ pressed }) => [
            styles.confirmWrap,
            pressed && !submitting && styles.pressed,
            submitting && styles.confirmDisabled,
          ]}
        >
          <MatchLinearGradient
            colors={CONFIRM_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirm}
          >
            <Text style={styles.confirmText}>
              {submitting ? "处理中..." : "确认下单"}
            </Text>
          </MatchLinearGradient>
        </Pressable>
      </BottomSheet>

      <MatchPaySheet {...selectAndPay.paySheetProps} />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  title: {
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0A0A0A",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    maxHeight: 320,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: "#FE4267",
  },
  nickname: {
    maxWidth: 160,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  remark: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 16,
    color: "#999999",
  },
  check: {
    marginLeft: "auto",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.2)",
  },
  checkSelected: {
    borderColor: "#FE4267",
    backgroundColor: "#FE4267",
  },
  empty: {
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 24,
  },
  confirmWrap: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  confirm: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  confirmText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
});
