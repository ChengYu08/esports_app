import { CourtAvatar } from "@/features/court/components/CourtAvatar";
import { CourtJudgmentResult } from "@/features/court/components/CourtJudgmentResult";
import { CourtReviewerPromptModal } from "@/features/court/components/CourtReviewerPromptModal";
import { courtVoteUnavailableReason, submitCourtVote } from "@/features/court/court-vote";
import { CourtVoteButton } from "@/features/court/components/CourtVoteButton";
import {
  courtApi,
  formatCount,
  formatTime,
  mapCaseStage,
  type CourtCase,
} from "@/features/court/court.api";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-root-toast";

type DetailTab = "原告举证" | "被告举证" | "判决流程";

export default function CourtDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, mine } = useLocalSearchParams<{ id: string; mine?: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [item, setItem] = useState<CourtCase | null>(null);
  const [tab, setTab] = useState<DetailTab>("原告举证");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"vote" | "favorite" | null>(null);
  const busy = pendingAction !== null;
  const [reviewerPromptVisible, setReviewerPromptVisible] = useState(false);
  const voteInFlight = useRef(false);
  const isMine = mine === "1";
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const detail = await courtApi.getDetail(id, isMine);
      if (
        requestId === loadRequestRef.current &&
        accessToken === useAuthStore.getState().accessToken
      ) {
        setItem(detail);
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      Toast.show(error instanceof Error ? error.message : "案件加载失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, id, isMine]);

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      setReviewerPromptVisible(false);
      load();
    }, 0);
    return () => {
      clearTimeout(timer);
      loadRequestRef.current += 1;
    };
  }, [load]));


  const stage = useMemo(() => (item ? mapCaseStage(item) : null), [item]);
  async function copyCaseId() {
    if (!item) {
      return;
    }
    try {
      await Clipboard.setStringAsync(String(item.caseNo || item.caseId));
      Toast.show("案件ID已复制", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.CENTER,
      });
    } catch {
      Toast.show("复制失败，请稍后重试", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.CENTER,
      });
    }
  }
  const evidence =
    tab === "原告举证"
      ? (item?.plaintiffEvidenceSubmissions ?? [])
      : (item?.defendantEvidenceSubmissions ?? []);
  const allowed = new Set(item?.actions ?? []);
  const voting = item?.stage === "VOTING";
  const hasVoted = Boolean(item?.myVoteResult);
  const showVotes = voting || hasVoted || Boolean(item?.result);
  const voteUnavailable = !item || courtVoteUnavailableReason(item) !== null;

  async function castVote(side: "PLAINTIFF_WIN" | "DEFENDANT_WIN") {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (!item || busy || voteInFlight.current) {
      return;
    }
    voteInFlight.current = true;
    setPendingAction("vote");
    try {
      const outcome = await submitCourtVote(item, side);
      if (accessToken !== useAuthStore.getState().accessToken) {
        return;
      }
      if (outcome.type === "reviewer-required") {
        setReviewerPromptVisible(true);
        return;
      }
      setItem((current) => current && String(current.caseId) === String(item.caseId)
        ? { ...current, myVoteResult: side }
        : current);
      Toast.show("支持成功", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.CENTER,
      });
      await load();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "投票失败", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.CENTER,
      });
    } finally {
      voteInFlight.current = false;
      setPendingAction(null);
    }
  }

  async function favorite() {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (!item || busy) {
      return;
    }
    setPendingAction("favorite");
    try {
      const result = await courtApi.favorite(item.caseId, !item.favorited);
      setItem((current) => {
        if (!current || String(current.caseId) !== String(item.caseId)) {
          return current;
        }
        return {
          ...current,
          favorited: result.favorited,
          favoriteCount: result.favoriteCount ?? current.favoriteCount,
        };
      });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "收藏失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (loading && !item)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#ff3158" />
      </View>
    );
  if (!item || !stage)
    return (
      <View style={styles.loading}>
        <Text style={styles.muted}>案件暂不可用</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>返回</Text>
        </Pressable>
      </View>
    );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>评审详情</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor="#ff3158"
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.overview}>
          <View style={styles.summary}>
            <Text style={styles.caseTitle}>{stage.stage}</Text>
            <View style={styles.summaryDetails}>
              <View style={styles.metadata}>
                <View style={styles.metadataRow}>
                  <Metadata
                    label="案件ID"
                    value={String(item.caseNo || item.caseId)}
                    onCopy={copyCaseId}
                  />
                  <Metadata label="服务类型" value={item.serviceName || item.gameName || "服务订单"} />
                </View>
                <View style={styles.metadataRow}>
                  <Metadata label="接单人员" value={item.companionNickname || item.defendant?.nickname || "-"} />
                  <Metadata label="诉求类型" value={caseTypeLabel(item.caseType)} />
                </View>
              </View>
              <View style={styles.parties}>
                <Profile
                  name={item.plaintiff?.nickname || "未知用户"}
                  avatar={item.plaintiff?.avatar}
                  role="原告"
                />
                <CachedImage source={require("../../../../assets/court/versus.svg")} contentFit="contain" style={styles.vs} />
                <Profile
                  name={item.defendant?.nickname || "未知用户"}
                  avatar={item.defendant?.avatar}
                  role="被告"
                  right
                />
              </View>
            </View>
          </View>
          <View style={styles.complaint}>
            <Text style={styles.body}>
              {item.content || item.contentSummary || "暂无投诉内容"}
            </Text>
            {!!item.reviewContent && (
              <View>
                <Text style={styles.blockTitle}>差评内容</Text>
                <Text style={styles.body}>{item.reviewContent}</Text>
                {!!item.reviewRating && (
                  <Text style={styles.rating}>★ {item.reviewRating} 分</Text>
                )}
              </View>
            )}
            {!!item.reviewImageUrls?.length && (
              <View style={[styles.imageRow, styles.complaintImages]}>
                {item.reviewImageUrls.slice(0, 6).map((uri, index) => (
                  <CachedImage
                    key={`${uri}-${index}`}
                    source={{ uri }}
                    style={styles.imageThumb}
                  />
                ))}
              </View>
            )}
          </View>

          {showVotes && (
            <View style={styles.voteActions}>
              <CourtVoteButton
                side="plaintiff"
                selected={item.myVoteResult === "PLAINTIFF_WIN"}
                disabled={busy}
                onPress={() => castVote("PLAINTIFF_WIN")}
                muted={voteUnavailable}
                count={item.voteSummary?.plaintiff ?? 0}
                loading={pendingAction === "vote"}
              />
              <CourtVoteButton
                side="defendant"
                selected={item.myVoteResult === "DEFENDANT_WIN"}
                disabled={busy}
                onPress={() => castVote("DEFENDANT_WIN")}
                muted={voteUnavailable}
                count={item.voteSummary?.defendant ?? 0}
                loading={pendingAction === "vote"}
              />
            </View>
          )}
          <View style={styles.stats}>
            <View style={styles.stat}>
              <CachedImage source={require("../../../../assets/court/eye.svg")} style={styles.statIcon} />
              <Text style={styles.statText}>{formatCount(item.viewCount)}</Text>
            </View>
            <View style={styles.stat}>
              <CachedImage source={item.favorited ? require("../../../../assets/court/star-filled.svg") : require("../../../../assets/court/star.svg")} style={styles.statIcon} />
              <Text style={styles.statText}>{formatCount(item.favoriteCount)}</Text>
            </View>
          </View>
        </View>

        <CourtJudgmentResult item={item} />

        <View style={styles.tabs}>
          {(["原告举证", "被告举证", "判决流程"] as DetailTab[]).map(
            (value) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={styles.tab}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === value && styles.tabTextSelected,
                  ]}
                >
                  {value}
                </Text>
                {tab === value && <CachedImage source={require("../../../../assets/court/tab-indicator.svg")} style={styles.tabLine} />}
              </Pressable>
            ),
          )}
        </View>
        {tab === "判决流程" ? (
          <View style={styles.timeline}>
            {(item.timeline ?? []).length ? (
              item.timeline?.map((entry, index) => (
                <View
                  key={`${entry.eventType}-${index}`}
                  style={styles.timelineRow}
                >
                  <View style={styles.timelineMark}>
                    <View
                      style={[styles.dot, index === 0 && styles.dotCurrent]}
                    />
                    {index < (item.timeline?.length ?? 0) - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.timelineText}>
                    <Text style={styles.timelineTitle}>
                      {timelineLabel(entry.eventType, entry.toStage)}
                    </Text>
                    {!!entry.reason && (
                      <Text style={styles.timelineReason}>{entry.reason}</Text>
                    )}
                    <Text style={styles.timelineTime}>
                      {formatTime(entry.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>暂无流程记录</Text>
            )}
          </View>
        ) : (
          <View style={styles.evidenceList}>
            {evidence.length ? (
              evidence.map((submission, index) => (
                <View
                  key={`${submission.submittedAt}-${index}`}
                  style={styles.evidenceItem}
                >
                  <Text style={styles.evidenceLabel}>
                    {tab} ·{" "}
                    {submission.level === "SECOND"
                      ? "二审"
                      : submission.level === "THIRD"
                        ? "三审"
                        : "一审"}
                  </Text>
                  {!!submission.content && (
                    <Text style={styles.body}>{submission.content}</Text>
                  )}
                  {!!submission.imageUrls?.length && (
                    <View style={styles.imageRow}>
                      {submission.imageUrls
                        .slice(0, 9)
                        .map((uri, imageIndex) => (
                          <CachedImage
                            key={`${uri}-${imageIndex}`}
                            source={{ uri }}
                            style={styles.imageThumb}
                          />
                        ))}
                    </View>
                  )}
                  <Text style={styles.timelineTime}>
                    {formatTime(submission.submittedAt)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>暂无举证</Text>
            )}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {isMine && allowed.has("SUPPLEMENT_EVIDENCE") && (
          <Pressable
            onPress={() =>
              router.push(
                `/court/complaint?mode=evidence&caseId=${item.caseId}`,
              )
            }
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryText}>补充举证</Text>
          </Pressable>
        )}
        {isMine && allowed.has("APPEAL") && (
          <Pressable
            onPress={() =>
              router.push(`/court/complaint?mode=appeal&caseId=${item.caseId}`)
            }
            style={styles.primaryAction}
          >
            <Text style={styles.primaryText}>申诉</Text>
          </Pressable>
        )}
        {isMine && allowed.has("RESUBMIT") && (
          <Pressable
            onPress={() =>
              router.push(`/court/complaint?mode=court&caseId=${item.caseId}`)
            }
            style={styles.primaryAction}
          >
            <Text style={styles.primaryText}>重新提交</Text>
          </Pressable>
        )}
        {!isMine && (
          <Pressable
            onPress={favorite}
            accessibilityState={{ disabled: busy, busy: pendingAction === "favorite" }}
            disabled={busy}
            style={styles.favoriteAction}
          >
            <Text style={styles.favoriteText}>{item.favorited ? "取消收藏" : "收藏"}</Text>
          </Pressable>
        )}
      </View>
      <CourtReviewerPromptModal
        visible={reviewerPromptVisible}
        onClose={() => setReviewerPromptVisible(false)}
      />
    </View>
  );
}

function Metadata({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <View style={styles.metadataItem}>
      <Text style={styles.metadataLabel}>{label}</Text>
      {onCopy ? (
        <Pressable
          accessibilityLabel="复制案件ID"
          accessibilityRole="button"
          onPress={onCopy}
          style={styles.metadataCopy}
        >
          <Text numberOfLines={1} style={styles.metadataValue}>{value}</Text>
          <CachedImage
            source={require("../../../../assets/coms/copy.svg")}
            style={styles.copyIcon}
          />
        </Pressable>
      ) : (
        <Text numberOfLines={1} style={styles.metadataValue}>{value}</Text>
      )}
    </View>
  );
}

function Profile({
  name,
  avatar,
  role,
  right,
}: {
  name: string;
  avatar?: string;
  role: string;
  right?: boolean;
}) {
  return (
    <View style={styles.profile}>
      <Text style={[styles.role, right ? styles.defendant : styles.plaintiff]}>{role}</Text>
      <CourtAvatar uri={avatar} size={40} />
      <Text numberOfLines={1} style={styles.name}>{name}</Text>
    </View>
  );
}

function caseTypeLabel(code?: string) {
  return (
    (
      {
        DELETE_REVIEW: "删除差评",
        RETRAIN: "重新培训",
        APOLOGY: "诉求道歉",
        FINE: "要求罚款",
      } as Record<string, string>
    )[code || ""] || "投诉"
  );
}
function timelineLabel(type?: string, stage?: string) {
  // 流程标题与 web 端 utils/courtProcessTimeline.ts 保持一致。
  const eventLabels: Record<string, string> = {
    CASE_SUBMITTED: "案件提交",
    CASE_ACCEPTED: "案件受理",
    EVIDENCE_STARTED: "举证阶段",
    VOTING_STARTED: "评审投票",
    EVIDENCE_TIMEOUT: "评审投票",
    CASE_JUDGED: "判决结果",
    SECOND_CASE_JUDGED: "判决结果",
    CASE_APPEALED: "申请二审",
    APPEAL_ACCEPTED: "二审受理",
    CASE_THIRD_APPEALED: "确认开庭",
    CASE_CLOSED: "案件关闭",
  };
  const stageLabels: Record<string, string> = {
    DRAFT: "草稿",
    SUBMITTED: "案件提交",
    PENDING_RE_SUBMIT: "待重新提交",
    ACCEPTED: "案件受理",
    EVIDENCE: "举证阶段",
    VOTING: "评审投票",
    JUDGED: "判决结果",
    APPEALING: "申诉中",
    HEARING: "确认开庭",
    CLOSED: "案件关闭",
  };

  return (
    eventLabels[type || ""] ||
    stageLabels[type || ""] ||
    stageLabels[stage || ""] ||
    "流程更新"
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F5F6F7", flex: 1 },
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
  backText: { color: "#0D0D0F", fontSize: 32, lineHeight: 34 },
  headerTitle: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  content: { paddingTop: 8, paddingBottom: 20 },
  overview: { backgroundColor: "#FFFFFF", padding: 16, gap: 16 },
  summary: { gap: 24 },
  summaryDetails: { gap: 12 },
  caseTitle: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  metadata: { gap: 8 },
  metadataRow: { flexDirection: "row", gap: 8 },
  metadataItem: { flex: 1, minWidth: 0, flexDirection: "row", gap: 2 },
  metadataLabel: { width: 48, color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 11, lineHeight: 16 },
  metadataValue: { flex: 1, color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 11, lineHeight: 16 },
  metadataCopy: { alignItems: "center", flex: 1, flexDirection: "row", gap: 4, minWidth: 0 },
  copyIcon: { height: 12, width: 12 },
  parties: {
    alignItems: "center",
    backgroundColor: "#F5F6F7",
    borderRadius: 8,
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profile: { alignItems: "center", flex: 1, gap: 6, minWidth: 0 },
  role: { fontFamily: COURT_FONT_FAMILY, fontSize: 14, fontWeight: "500", lineHeight: 22 },
  name: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "500", lineHeight: 18 },
  vs: { height: 24, width: 30.4 },
  plaintiff: { color: "#3DA5FF" },
  defendant: { color: "#FE4267" },
  complaint: { gap: 6 },
  body: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
  blockTitle: {
    color: "#222",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  rating: {
    color: "#ed9a2f",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    marginTop: 8,
  },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  complaintImages: { marginTop: 0 },
  imageThumb: {
    backgroundColor: "#eee",
    borderRadius: 6,
    height: 62,
    width: 62,
  },
  voteActions: { flexDirection: "row" },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statIcon: { width: 16, height: 16 },
  statText: { color: "#7F7F80", fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
  tabs: {
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tab: { paddingVertical: 4, position: "relative" },
  tabText: { color: "#656566", fontFamily: COURT_FONT_FAMILY, fontSize: 14, lineHeight: 22 },
  tabTextSelected: { color: "#0D0D0F", fontSize: 16, fontWeight: "600" },
  tabLine: {
    bottom: 0,
    height: 3,
    width: 12,
    left: "50%",
    marginLeft: -6,
    position: "absolute",
  },
  evidenceList: { backgroundColor: "#fff", minHeight: 140, padding: 16 },
  evidenceItem: {
    borderBottomColor: "#eee",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingTop: 4,
  },
  evidenceLabel: {
    color: "#3DA5FF",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    marginBottom: 7,
  },
  timeline: { backgroundColor: "#fff", minHeight: 140, padding: 14 },
  timelineRow: { flexDirection: "row", minHeight: 66 },
  timelineMark: { alignItems: "center", width: 18 },
  dot: {
    backgroundColor: "#ddd",
    borderRadius: 5,
    height: 9,
    marginTop: 4,
    width: 9,
  },
  dotCurrent: { backgroundColor: "#ff3158" },
  timelineLine: { backgroundColor: "#eee", flex: 1, width: 1 },
  timelineText: { flex: 1, paddingBottom: 12, paddingLeft: 8 },
  timelineTitle: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 12 },
  timelineReason: {
    color: "#777",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  timelineTime: {
    color: "#979799",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  footer: {
    alignItems: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  favoriteAction: {
    alignItems: "center",
    borderColor: "#E9E9EB",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  favoriteText: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 14, fontWeight: "500", lineHeight: 22 },
  secondaryAction: {
    alignItems: "center",
    borderColor: "#ff3158",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  secondaryText: { color: "#ff3158", fontFamily: COURT_FONT_FAMILY, fontSize: 13 },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#ff3158",
    borderRadius: 6,
    flex: 1,
    paddingVertical: 10,
  },
  primaryText: {
    color: "#fff",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "600",
  },
  loading: {
    alignItems: "center",
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
  },
  muted: { color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 12 },
  link: { color: "#ff3158", marginTop: 10 },
});
