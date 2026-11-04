import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { QuickMatchGrabItem } from "@/features/match/api/match.types";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchingCountdownText } from "@/features/match/components/MatchingCountdownText";
import { useProfileDetail } from "@/features/mine/hooks/use-profile-data";
import { calculateAge } from "@/features/mine/profile-utils";

const PUBLISH_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
const FOOTER_CONTENT_BOTTOM = 22;
const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");
/** Figma 444:57020 / 444:57016 性别图标 12×12 */
const maleIcon = require("../../../../assets/svgs/gender-male.svg");
const femaleIcon = require("../../../../assets/svgs/gender-female.svg");

/** UI 默认入场缓动（强 ease-out） */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** 卡片入场间隔（错峰） */
const CARD_STAGGER_MS = 70;
/** 单卡入场时长 */
const CARD_ENTER_MS = 260;
/** 新候选人金色光晕停留 + 淡出总时长 */
const GLOW_LINGER_MS = 400;
const GLOW_FADE_MS = 600;

type MatchingGrabListViewProps = {
  countdownText: string;
  countdownSec: number;
  candidates: QuickMatchGrabItem[];
  /** 最近一次轮询中新出现的候选人 id（用于一次性发光提示） */
  newCandidateIds?: ReadonlySet<string>;
  selectedGrabIds: string[];
  submitting: boolean;
  /** 技能类型为一陪多单时展示选人提示文案 */
  multiCompanion?: boolean;
  onSelect: (grabId: string) => void;
  onConfirm: () => void;
};

function GenderAge({ sex, age }: { sex: number; age: string }) {
  if (sex !== 1 && sex !== 2) {
    return null;
  }
  const isFemale = sex === 2;
  return (
    <View style={styles.genderRow}>
      <Image
        source={isFemale ? femaleIcon : maleIcon}
        style={styles.genderIcon}
        contentFit="contain"
      />
      {age ? (
        <Text style={[styles.age, isFemale ? styles.female : styles.male]}>
          {age}
        </Text>
      ) : null}
    </View>
  );
}

function formatConfirmLabel(
  selectedCount: number,
  submitting: boolean,
): string {
  if (submitting) return "处理中...";
  if (selectedCount === 0) return "选TA下单";
  return `选TA下单（${selectedCount}）`;
}

/** 单个候选人卡片：错峰入场 + 按压回弹 + 新陪玩一次性金色描边 */
function AnimatedGrabCard({
  item,
  index,
  isNew,
  selected,
  onSelect,
}: {
  item: QuickMatchGrabItem;
  index: number;
  isNew: boolean;
  selected: boolean;
  onSelect: (grabId: string) => void;
}) {
  // 抢单备注描述的是订单状态，签名和年龄应使用陪玩的公开个人资料。
  const { data: profile } = useProfileDetail(
    item.companionUserId
      ? { userId: item.companionUserId, clubId: item.clubId }
      : null,
  );
  const age = profile?.birth ? calculateAge(profile.birth) : "";
  const signature = profile?.signature.trim() || "暂无个性签名";
  const reducedMotion = useReducedMotion();
  const pressScale = useSharedValue(1);
  const glow = useSharedValue(0);

  // 新陪玩出现：金色描边亮一下停留 400ms 后淡出（一次性）
  useEffect(() => {
    if (!isNew || reducedMotion) return;
    glow.set(
      withTiming(1, { duration: 200, easing: EASE_OUT }, (finished) => {
        if (!finished) return;
        glow.set(
          withTiming(0, {
            duration: GLOW_LINGER_MS + GLOW_FADE_MS,
            easing: EASE_OUT,
          }),
        );
      }),
    );
  }, [glow, isNew, reducedMotion]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 1]),
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(60 + index * CARD_STAGGER_MS)
        .duration(CARD_ENTER_MS)
        .easing(EASE_OUT)}
      style={pressStyle}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelect(item.id)}
        onPressIn={() => {
          pressScale.set(withSpring(0.97, { duration: 200, dampingRatio: 1 }));
        }}
        onPressOut={() => {
          pressScale.set(withSpring(1, { duration: 200, dampingRatio: 1 }));
        }}
        pressRetentionOffset={8}
        style={[styles.card, selected && styles.cardSelected]}
      >
        <Image
          source={item.headImage ? { uri: item.headImage } : defaultAvatar}
          style={styles.avatar}
          contentFit="cover"
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.nickname}
            </Text>
            <GenderAge sex={profile?.sex ?? item.sex} age={age} />
          </View>
          <Text style={styles.signature} numberOfLines={1}>
            {signature}
          </Text>
        </View>
        {isNew ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.cardGlow, glowStyle]}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function MatchingGrabListView({
  countdownText,
  countdownSec,
  candidates,
  newCandidateIds,
  selectedGrabIds,
  submitting,
  multiCompanion,
  onSelect,
  onConfirm,
}: MatchingGrabListViewProps) {
  const insets = useSafeAreaInsets();
  const selectedCount = selectedGrabIds.length;
  const confirmLabel = formatConfirmLabel(selectedCount, submitting);
  const confirmDisabled = submitting || selectedCount === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.textBlock}>
          <Text style={styles.title}>选择你的陪玩大神</Text>
          <MatchingCountdownText
            countdownText={countdownText}
            seconds={countdownSec}
          />
        </View>

        <View style={styles.list}>
          {candidates.map((item, index) => (
            <AnimatedGrabCard
              key={item.id}
              item={item}
              index={index}
              isNew={Boolean(newCandidateIds?.has(item.id))}
              selected={selectedGrabIds.includes(item.id)}
              onSelect={onSelect}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: confirmDisabled }}
          disabled={confirmDisabled}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.confirmWrap,
            pressed && !confirmDisabled && styles.pressed,
          ]}
        >
          <MatchLinearGradient
            colors={PUBLISH_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.confirmButton,
              confirmDisabled && styles.confirmDisabled,
            ]}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </MatchLinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 24,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  list: {
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: "#FE4267",
  },
  cardGlow: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255, 199, 0, 0.9)",
    backgroundColor: "rgba(255, 199, 0, 0.12)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
  },
  meta: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    maxWidth: 152,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  genderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  genderIcon: {
    width: 12,
    height: 12,
  },
  age: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  male: {
    color: "#3DA5FF",
  },
  female: {
    color: "#FF42A1",
  },
  multiCompanionTip: {
    fontSize: 11,
    lineHeight: 16,
    color: "#FFFFFF",
  },
  signature: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.6)",
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  confirmWrap: {
    width: "100%",
  },
  confirmButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
  },
});
