import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import {
  buildCreateOrderAction,
  createCompanionOrder,
  fetchCompanionServices,
  type CompanionOrderContext,
  type CompanionServiceOption,
} from "@/features/mine/api/companion-order.api";
import type {
  ProfileDetail,
  ProfileSkillCard,
} from "@/features/mine/api/profile.types";
import {
  handleOrderFailurePromptConfirm,
  requiresRealNameVerification,
} from "@/features/mine/order-real-name";
import { calculateAge } from "@/features/mine/profile-utils";
import { CachedImage } from "@/shared/ui/CachedImage";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";

const fallbackAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const clubIcon = require("../../../../assets/mine/figma/mine-club-flag.svg");
const starDiamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");
const paymentCloseIcon = require("../../../../assets/mine/payment-close.svg");

const ORDER_QTY_MIN = 1;
const ORDER_QTY_MAX = 99;
const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

function clampOrderQuantity(value: number) {
  if (!Number.isFinite(value) || value < ORDER_QTY_MIN) return ORDER_QTY_MIN;
  return Math.min(ORDER_QTY_MAX, Math.trunc(value));
}

type CompanionOrderSheetProps = {
  card: ProfileSkillCard;
  profile: ProfileDetail;
  gameName: string;
  context: CompanionOrderContext;
  token: string | null;
  onClose: () => void;
  onRealNameVerificationRequired: () => void;
  onOrderCreated: (order: { orderId: number; total: number }) => void;
};

export function CompanionOrderSheet({
  card,
  profile,
  gameName,
  context,
  token,
  onClose,
  onRealNameVerificationRequired,
  onOrderCreated,
}: CompanionOrderSheetProps) {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<CompanionServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(
    card.companionServiceId,
  );
  const [quantity, setQuantity] = useState(ORDER_QTY_MIN);
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [prompt, setPrompt] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const [sheetY] = useState(() => new Animated.Value(420));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const age = profile.birth ? calculateAge(profile.birth) : "";
  const submitDisabled =
    submitting || loading || (Boolean(token) && !selectedServiceId);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      sheetY.stopAnimation();
      backdropOpacity.stopAnimation();
    };
  }, [backdropOpacity, sheetY]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchCompanionServices(
      {
        clubId: context.clubId,
        serviceUserId: context.serviceUserId,
        gameLevelId: context.gameLevelId,
      },
      token,
    )
      .then((items) => {
        if (!active) return;
        setServices(items);
        setSelectedServiceId((current) => {
          if (items.some((item) => item.companionServiceId === current)) {
            return current;
          }
          return items[0]?.companionServiceId ?? 0;
        });
      })
      .catch((error: Error) => {
        if (active) setPrompt({ message: error.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [context.clubId, context.gameLevelId, context.serviceUserId, token]);

  const selectedService = services.find(
    (item) => item.companionServiceId === selectedServiceId,
  );
  const total = (selectedService?.price ?? card.price) * quantity;

  async function submitOrder() {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!selectedService) {
      setPrompt({ message: "请选择服务" });
      return;
    }
    setSubmitting(true);
    try {
      const action = buildCreateOrderAction(
        context,
        selectedService,
        quantity,
        remark,
      );
      const order = await createCompanionOrder(action, token);
      onOrderCreated({
        orderId: order.orderId,
        total: Number(order.totalPrice) || action.total,
      });
    } catch (error) {
      setPrompt({
        title: "订单创建失败",
        message: error instanceof Error ? error.message : "创建订单失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function closeSheet(afterClose?: () => void) {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 420,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        afterClose?.();
      }
    });
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible
      onRequestClose={() => closeSheet()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.orderKeyboardAvoiding}
      >
        <Animated.View
          style={[styles.orderModalBackdrop, { opacity: backdropOpacity }]}
        >
          <Pressable
            accessibilityLabel="关闭下单弹窗"
            onPress={() => closeSheet()}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.orderModal,
              {
                paddingBottom: Math.max(insets.bottom, 12) + 8,
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <View style={styles.orderModalHeader}>
              <Text style={styles.orderModalTitle}>陪玩下单</Text>
              <Pressable
                accessibilityLabel="关闭"
                hitSlop={8}
                onPress={() => closeSheet()}
                style={styles.orderCloseButton}
              >
                <Image
                  source={paymentCloseIcon}
                  style={styles.orderCloseIcon}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.orderModalBody}
            >
              <View style={styles.orderCompanionCard}>
                <CachedImage
                  source={
                    profile.headImage
                      ? { uri: profile.headImage }
                      : fallbackAvatar
                  }
                  style={styles.orderCompanionAvatar}
                  contentFit="cover"
                />
                <View style={styles.orderCompanionMeta}>
                  <View style={styles.orderCompanionNameRow}>
                    <Text numberOfLines={1} style={styles.orderCompanionName}>
                      {profile.nickname}
                    </Text>
                    {profile.sex === 1 || profile.sex === 2 ? (
                      <Image
                        source={profile.sex === 1 ? maleIcon : femaleIcon}
                        style={styles.orderGenderIcon}
                      />
                    ) : null}
                    {age ? (
                      <Text
                        style={
                          profile.sex === 2
                            ? styles.orderFemaleAge
                            : styles.orderMaleAge
                        }
                      >
                        {age}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.orderClubRow}>
                    <Image source={clubIcon} style={styles.orderClubIcon} />
                    <Text numberOfLines={1} style={styles.orderClubName}>
                      {profile.clubName}
                    </Text>
                  </View>
                </View>
              </View>

              <OrderFieldRow label="游戏" required>
                <Text style={styles.orderFieldValue}>{gameName}</Text>
              </OrderFieldRow>

              <OrderFieldRow label="模式-等级" required>
                <Text style={styles.orderFieldValue}>
                  {card.modeName}-{card.levelName}
                </Text>
              </OrderFieldRow>

              <OrderFieldRow label="服务" required align="start">
                {loading ? (
                  <Text style={styles.orderHint}>服务加载中...</Text>
                ) : services.length === 0 ? (
                  <Text style={styles.orderHint}>暂无可选服务</Text>
                ) : (
                  <View style={styles.serviceChipWrap}>
                    {services.map((service) => {
                      const active =
                        selectedServiceId === service.companionServiceId;
                      return (
                        <Pressable
                          key={service.companionServiceId}
                          onPress={() =>
                            setSelectedServiceId(service.companionServiceId)
                          }
                          style={[
                            styles.serviceChip,
                            active && styles.serviceChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.serviceChipText,
                              active && styles.serviceChipTextActive,
                            ]}
                          >
                            {service.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </OrderFieldRow>

              <OrderFieldRow label="数量" required>
                <View style={styles.qtyStepper}>
                  <Pressable
                    accessibilityLabel="减少数量"
                    disabled={quantity <= ORDER_QTY_MIN}
                    onPress={() =>
                      setQuantity((value) => clampOrderQuantity(value - 1))
                    }
                    style={[
                      styles.qtyButton,
                      quantity <= ORDER_QTY_MIN && styles.qtyButtonDisabled,
                    ]}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </Pressable>
                  <View style={styles.qtyDivider} />
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <View style={styles.qtyDivider} />
                  <Pressable
                    accessibilityLabel="增加数量"
                    disabled={quantity >= ORDER_QTY_MAX}
                    onPress={() =>
                      setQuantity((value) => clampOrderQuantity(value + 1))
                    }
                    style={[
                      styles.qtyButton,
                      quantity >= ORDER_QTY_MAX && styles.qtyButtonDisabled,
                    ]}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </Pressable>
                </View>
              </OrderFieldRow>

              <OrderFieldRow label="备注" align="start">
                <TextInput
                  placeholder="填写要求"
                  placeholderTextColor="#CACACC"
                  value={remark}
                  onChangeText={setRemark}
                  style={styles.remarkInput}
                />
              </OrderFieldRow>

              <OrderFieldRow label="预估价格" required>
                <View style={styles.orderPriceRow}>
                  <Text style={styles.orderPriceValue}>{total}</Text>
                  <Image
                    source={starDiamondIcon}
                    style={styles.orderPriceDiamond}
                  />
                </View>
              </OrderFieldRow>
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="立即下单"
              accessibilityState={{ disabled: submitDisabled }}
              disabled={submitDisabled}
              onPress={() => void submitOrder()}
              style={({ pressed }) => [
                styles.orderSubmitWrap,
                pressed && !submitDisabled && styles.orderPressed,
                submitDisabled && styles.orderSubmitDisabled,
              ]}
            >
              <MatchLinearGradient
                colors={CONFIRM_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.orderSubmit}
              >
                <Text style={styles.orderSubmitText}>
                  {submitting ? "下单中..." : "立即下单"}
                </Text>
              </MatchLinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
      <AppPrompt
        visible={Boolean(prompt)}
        title={prompt?.title}
        message={prompt?.message ?? ""}
        cancelText={
          requiresRealNameVerification(prompt?.message ?? "")
            ? "我知道了"
            : undefined
        }
        confirmText={
          requiresRealNameVerification(prompt?.message ?? "")
            ? "去认证"
            : undefined
        }
        onCancel={() => setPrompt(null)}
        onConfirm={() => {
          handleOrderFailurePromptConfirm(prompt?.message ?? "", {
            dismissPrompt: () => setPrompt(null),
            dismissSheet: closeSheet,
            openVerification: onRealNameVerificationRequired,
          });
        }}
      />
    </Modal>
  );
}

function OrderFieldRow({
  label,
  required = false,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.orderFieldRow,
        align === "start" && styles.orderFieldRowStart,
      ]}
    >
      <View style={styles.orderFieldLabelWrap}>
        <Text style={styles.orderFieldLabel}>{label}</Text>
        {required ? <Text style={styles.orderFieldRequired}>*</Text> : null}
      </View>
      <View style={styles.orderFieldContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  orderModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.70)",
  },
  orderKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  orderModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "88%",
    overflow: "hidden",
  },
  orderModalHeader: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingRight: 48,
    justifyContent: "center",
  },
  orderModalTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  orderCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCloseIcon: { width: 24, height: 24 },
  orderModalBody: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 16,
  },
  orderCompanionCard: {
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderCompanionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 76,
    backgroundColor: "#DDDDDD",
  },
  orderCompanionMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  orderCompanionNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderCompanionName: {
    flexShrink: 1,
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
  },
  orderGenderIcon: { width: 12, height: 12 },
  orderMaleAge: {
    color: "#0095EE",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
  },
  orderFemaleAge: {
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
  },
  orderClubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orderClubIcon: { width: 12, height: 12 },
  orderClubName: {
    flex: 1,
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  orderFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderFieldRowStart: {
    alignItems: "flex-start",
  },
  orderFieldLabelWrap: {
    width: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  orderFieldLabel: {
    color: "#656566",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  orderFieldRequired: {
    color: "#FE4267",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  orderFieldContent: {
    flex: 1,
    minWidth: 0,
  },
  orderFieldValue: {
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  orderHint: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  serviceChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: "#F5F6F7",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceChipActive: {
    backgroundColor: "#FFF5F7",
    borderWidth: 0.5,
    borderColor: "#FE4267",
  },
  serviceChipText: {
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  serviceChipTextActive: {
    color: "#FE1F4C",
    fontWeight: "500",
  },
  qtyStepper: {
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F7F7F7",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  qtyButton: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyButtonText: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
  },
  qtyDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: "#E5E5E5",
  },
  qtyValue: {
    width: 40,
    textAlign: "center",
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 22,
  },
  remarkInput: {
    height: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  orderPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderPriceValue: {
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  orderPriceDiamond: {
    width: 16,
    height: 16,
  },
  orderSubmitWrap: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  orderSubmit: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orderSubmitDisabled: {
    opacity: 0.6,
  },
  orderPressed: {
    opacity: 0.9,
  },
  orderSubmitText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
