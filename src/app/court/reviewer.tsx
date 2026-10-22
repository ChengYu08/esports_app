import { courtApi } from "@/features/court/court.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CourtReviewerScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<{
    status?: string;
    pageStatus?: string;
    realNameVerified?: boolean;
    registrationPeriodSatisfied?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageStatus = status?.pageStatus || status?.status || "UNAPPLIED";
  const approved = pageStatus === "APPROVED";
  const pending =
    pageStatus === "PENDING" ||
    pageStatus === "PROCESSING" ||
    pageStatus === "SUBMITTED";

  async function load() {
    setLoading(true);
    try {
      setStatus(await courtApi.getReviewerStatus());
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "评委信息加载失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [accessToken]);

  async function apply() {
    if (submitting || approved || pending) return;
    setSubmitting(true);
    try {
      await courtApi.applyReviewer();
      Toast.show("申请已提交", { duration: Toast.durations.SHORT });
      await load();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "申请失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 48 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>成为评委</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>
            {approved
              ? "你已成为法庭评委"
              : pending
                ? "评委申请审核中"
                : "加入法庭评审员"}
          </Text>
          <Text style={styles.introText}>
            基于事实保持客观中立，认真了解案件情况，共同维护公平的评审环境。
          </Text>
        </View>
        <Text style={styles.sectionTitle}>申请条件</Text>
        <Requirement title="实名认证" ok={status?.realNameVerified} />
        <Requirement
          title="注册时间满 7 天"
          ok={status?.registrationPeriodSatisfied}
        />
        <Text style={styles.sectionTitle}>评审准则</Text>
        {[
          "基于事实保持客观中立，力求裁决公平",
          "保持严肃负责的态度，不敷衍、不偏袒",
          "充分了解事情全貌，结合实际情况综合分析",
          "坚持无罪推定，证据不足时优先保障当事人权益",
        ].map((text, index) => (
          <View key={text} style={styles.rule}>
            <Text style={styles.ruleNumber}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.ruleText}>{text}</Text>
          </View>
        ))}
        {pending && <Text style={styles.pending}>申请审核中，请耐心等待</Text>}
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Pressable
          disabled={loading || submitting || approved || pending}
          onPress={() => void apply()}
          style={[
            styles.submit,
            (loading || approved || pending) && styles.submitDisabled,
          ]}
        >
          {loading || submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {approved ? "已通过审核" : pending ? "审核中" : "申请成为评委"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Requirement({ title, ok }: { title: string; ok?: boolean }) {
  return (
    <View style={styles.requirement}>
      <View>
        <Text style={styles.requirementTitle}>{title}</Text>
        <Text style={styles.requirementText}>{ok ? "已满足" : "尚未满足"}</Text>
      </View>
      <Text style={[styles.requirementStatus, ok && styles.done]}>
        {ok ? "✓" : "待完成"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f7f7f7", flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  back: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  backText: { color: "#111", fontSize: 32, lineHeight: 34 },
  title: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  content: { padding: 12, paddingBottom: 24 },
  intro: { backgroundColor: "#fff", borderRadius: 8, padding: 14 },
  introTitle: {
    color: "#171717",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "700",
  },
  introText: {
    color: "#888",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  sectionTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 18,
  },
  requirement: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: 12,
  },
  requirementTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  requirementText: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    marginTop: 4,
  },
  requirementStatus: {
    color: "#ed7c2f",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
  },
  done: { color: "#16a67a", fontSize: 18 },
  rule: {
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 6,
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  ruleNumber: {
    color: "#ff3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    fontWeight: "700",
  },
  ruleText: {
    color: "#555",
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  pending: {
    color: "#e77b25",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    marginTop: 12,
  },
  footer: {
    backgroundColor: "#fff",
    borderTopColor: "#eee",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  submit: {
    alignItems: "center",
    backgroundColor: "#ff3158",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  submitDisabled: { backgroundColor: "#f2a0ae" },
  submitText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
});
