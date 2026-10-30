import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { courtApi, type CourtReviewerStatus } from "@/features/court/court.api";
import { canApplyCourtReviewer, isCourtReviewerApproved } from "@/features/court/court-vote";
import { RealNameVerificationSheet } from "@/features/mine/components/RealNameVerificationSheet";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export default function CourtReviewerScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const realName = useAuthStore((state) => state.user?.realName);
  const maskedName = realName?.trim() ? `${Array.from(realName.trim())[0]}**` : "";
  const [status, setStatus] = useState<CourtReviewerStatus | null>(null);
  const [realNameVisible, setRealNameVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef(0);
  const submittingRef = useRef(false);
  const pageStatus = (status?.pageStatus || status?.status || "UNAPPLIED").toUpperCase();
  const approved = status !== null && isCourtReviewerApproved(status);
  const canApply = canApplyCourtReviewer(status);
  const pending =
    pageStatus === "PENDING" ||
    pageStatus === "PROCESSING" ||
    pageStatus === "SUBMITTED";

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const latest = await courtApi.getReviewerStatus();
      if (request === requestRef.current && accessToken === useAuthStore.getState().accessToken) {
        setStatus(latest);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "评审员信息加载失败");
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken]);
  useFocusEffect(useCallback(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    const timer = setTimeout(() => {
      setStatus(null);
      load();
    }, 0);
    return () => {
      clearTimeout(timer);
      requestRef.current += 1;
    };
  }, [accessToken, load]));

  async function apply() {
    if (loading || submittingRef.current || !canApply) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await courtApi.applyReviewer();
      router.dismissTo({ pathname: "/(tabs)", params: { reviewerApplied: "1" } });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "申请失败");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const submitDisabled = loading || submitting || !canApply;
  const submitLabel = approved
    ? "已成为评审员"
    : pending
      ? "申请审核中"
      : !canApply
        ? "暂不满足申请条件"
        : "我已知晓，成为评审员";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 44 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft24Regular color="#111111" width={24} height={24} style={styles.backIcon} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>成为评审员</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <View style={styles.requirements}>
            <Requirement
              title="实名认证"
              description={maskedName || (status?.realNameVerified ? "已完成实名认证" : "完成实名认证后可申请")}
              badge={loading ? "加载中" : status?.realNameVerified ? "已认证" : "去认证"}
              satisfied={status?.realNameVerified === true}
              disabled={loading || submitting}
              onPress={status && !status.realNameVerified ? () => setRealNameVisible(true) : undefined}
            />
            <Requirement
              title="注册时间满7天"
              badge={loading ? "加载中" : status?.registrationPeriodSatisfied ? "已满足" : "不满足"}
              satisfied={status?.registrationPeriodSatisfied === true}
            />
          </View>

          <Text style={styles.sectionTitle}>加入法庭评审员需要遵守以下准则:</Text>
          <View style={styles.rules}>
            {[
              "基于事实保持客观中立，力求裁决公平；",
              "保持严肃负责的态度，不敷衍，不偏袒；",
              "充分了解事情全貌，结合实际情况综合分析；",
              "坚持「无罪推定」精神，证据不定时优先保障当事人权益",
            ].map((text, index) => (
              <View key={text} style={styles.rule}>
                <Text style={styles.ruleNumber}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={styles.ruleText}>{text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.warning}>若违反，您可能收到取消评审员资格及一系列处罚</Text>
          {pending && <Text style={styles.statusNote}>申请审核中，请耐心等待</Text>}
          {pageStatus === "REJECTED" && !!status?.reviewReason && (
            <Text style={styles.statusNote}>审核未通过：{status.reviewReason}</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled, busy: loading || submitting }}
          disabled={submitDisabled}
          onPress={apply}
          style={styles.submitButton}
        >
          <View style={styles.submit}>
            <ReviewerButtonBackground disabled={submitDisabled} />
            {loading || submitting ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.submitText}>{submitLabel}</Text>
            )}
          </View>
        </Pressable>
      </View>
      <RealNameVerificationSheet
        visible={realNameVisible}
        onClose={() => setRealNameVisible(false)}
        onVerified={load}
      />
    </View>
  );
}

function ReviewerButtonBackground({ disabled }: { disabled: boolean }) {
  const [{ width, height }, setSize] = useState({ width: 1, height: 1 });
  const angle = (102 * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const length = width * dx + height * dy;

  // CSS gradient stops can extend beyond 100%; place the SVG endpoints at
  // 12.12% and 107.82% of the 102-degree gradient line, using the actual size.
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((current) => current.width === layout.width && current.height === layout.height
          ? current
          : { width: layout.width, height: layout.height });
      }}
    >
      <Svg width="100%" height="100%" accessible={false}>
        <Defs>
          <LinearGradient
            id="reviewerSubmitGradient"
            gradientUnits="userSpaceOnUse"
            x1={disabled ? 0 : width / 2 + dx * length * (0.1212 - 0.5)}
            y1={disabled ? 0 : height / 2 + dy * length * (0.1212 - 0.5)}
            x2={disabled ? width : width / 2 + dx * length * (1.0782 - 0.5)}
            y2={disabled ? 0 : height / 2 + dy * length * (1.0782 - 0.5)}
          >
            <Stop offset="0" stopColor={disabled ? "#FF606C" : "#FF1F2E"} />
            <Stop offset="1" stopColor={disabled ? "#FF5D93" : "#FF1F69"} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#reviewerSubmitGradient)" />
      </Svg>
    </View>
  );
}

type RequirementProps = {
  title: string;
  description?: string;
  badge: string;
  satisfied?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

function Requirement({ title, description, badge, satisfied, disabled, onPress }: RequirementProps) {
  const badgeStyle = [styles.badge, onPress && styles.badgeActive];
  return (
    <View style={styles.requirement}>
      <View style={styles.requirementCopy}>
        <Text style={styles.requirementTitle}>{title}</Text>
        {!!description && <Text style={styles.requirementText}>{description}</Text>}
      </View>
      {satisfied ? (
        <CachedImage
          source={require("../../../../assets/court/requirement-satisfied.svg")}
          accessible
          accessibilityLabel={`${title}：已满足`}
          style={styles.requirementSatisfied}
        />
      ) : onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="去实名认证"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={8}
          onPress={onPress}
          style={badgeStyle}
        >
          <Text style={styles.badgeText}>{badge}</Text>
        </Pressable>
      ) : (
        <View style={badgeStyle}><Text style={styles.badgeText}>{badge}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F7F7", flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  back: { alignItems: "flex-start", height: 44, justifyContent: "center", width: 44 },
  backIcon: { width: 24, height: 24 },
  title: { color: "#111111", fontFamily: COURT_FONT_FAMILY, fontSize: 16, fontWeight: "500", lineHeight: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  panel: { backgroundColor: "#FFFFFF", padding: 16 },
  requirements: { gap: 12 },
  requirement: {
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    padding: 12,
  },
  requirementCopy: { flex: 1, gap: 4 },
  requirementTitle: { color: "#111111", fontFamily: COURT_FONT_FAMILY, fontSize: 14, fontWeight: "500", lineHeight: 20 },
  requirementText: { color: "#999999", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  requirementSatisfied: { width: 16, height: 16 },
  badge: { alignItems: "center", backgroundColor: "#FF6B8D", borderRadius: 20, justifyContent: "center", minHeight: 26, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: "#FE1F4C" },
  badgeText: { color: "#FFFFFF", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  sectionTitle: { color: "#111111", fontFamily: COURT_FONT_FAMILY, fontSize: 14, fontWeight: "500", lineHeight: 20, marginBottom: 12, marginTop: 24 },
  rules: { gap: 4 },
  rule: { alignItems: "flex-start", backgroundColor: "#FAFAFA", borderRadius: 8, flexDirection: "row", gap: 8, minHeight: 34, paddingHorizontal: 10, paddingVertical: 8 },
  ruleNumber: { color: "#FE1F4C", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  ruleText: { color: "#111111", flex: 1, fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  warning: { color: "#999999", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "400", lineHeight: 18, marginTop: 12 },
  statusNote: { color: "#999999", fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, marginTop: 8 },
  footer: { backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingTop: 8 },
  submitButton: { borderRadius: 8, overflow: "hidden" },
  submit: { alignItems: "center", justifyContent: "center", minHeight: 42, paddingHorizontal: 12, paddingVertical: 10 },
  submitText: { color: "#FFFFFF", fontFamily: COURT_FONT_FAMILY, fontSize: 14, fontWeight: "500", lineHeight: 22 },
});
