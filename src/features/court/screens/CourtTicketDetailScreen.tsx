import { ChevronLeft24Regular, Copy16Regular } from "@fluentui/react-native-icons";
import {
  courtApi,
  formatTime,
  type PlatformTicket,
} from "@/features/court/court.api";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { CachedImage } from "@/shared/ui/CachedImage";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CourtTicketDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, mine } = useLocalSearchParams<{ id: string; mine?: string }>();
  const [ticket, setTicket] = useState<PlatformTicket | null>(null);
  const [loadError, setLoadError] = useState("");
  const [imageWidth, setImageWidth] = useState(62);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isMine = mine === "1";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTicket(await courtApi.getTicketDetail(id, isMine));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "工单加载失败");
      Toast.show(error instanceof Error ? error.message : "工单加载失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setLoading(false);
    }
  }, [id, isMine]);
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function sendReply() {
    if (!isMine || !reply.trim() || !ticket?.ticketId || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await courtApi.replyTicket(ticket.ticketId, reply.trim());
      setReply("");
      Toast.show("补充内容已提交", { duration: Toast.durations.SHORT });
      await load();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "提交失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const images = ticket?.evidenceThumbnails?.filter(Boolean) ?? [];
  const ticketNumber = String(ticket?.ticketNo || ticket?.ticketId || "");
  const officialReplies = ticket?.adminReply
    ? [ticket.adminReply]
    : (ticket?.messageList ?? [])
        .filter(
          (message) =>
            message.senderType === "ADMIN" &&
            (isMine || message.visibility !== "HIDDEN"),
        )
        .map((message) => message.content)
        .filter((content): content is string => Boolean(content));

  async function copyTicketNumber() {
    if (!ticketNumber) {
      return;
    }
    try {
      await Clipboard.setStringAsync(ticketNumber);
      Toast.show("案件 ID 已复制", { duration: Toast.durations.SHORT });
    } catch {
      Toast.show("复制失败，请重试", { duration: Toast.durations.SHORT });
    }
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 44 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft24Regular color="#0D0D0F" width={24} height={24} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.title}>工单详情</Text>
        <View style={styles.back} />
      </View>
      {loading && !ticket ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff3158" />
        </View>
      ) : !ticket ? (
        <View style={styles.center}>
          <Text style={styles.replyBody}>
            {loadError || "工单不存在或暂不可查看"}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={load}
            style={styles.resubmit}
          >
            <Text style={styles.resubmitText}>重新加载</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {ticket && (
              <>
                <View style={styles.summary}>
                  <Text style={styles.heading}>{label(ticket.reasonType)}</Text>
                  <View style={styles.metadata}>
                    <View style={styles.row}>
                      <View style={styles.metadataCell}>
                        <Text style={styles.metadataLabel}>案件ID</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`复制案件 ID ${ticketNumber}`}
                          disabled={!ticketNumber}
                          onPress={copyTicketNumber}
                          hitSlop={8}
                          style={styles.copyButton}
                        >
                          <Text numberOfLines={1} style={styles.metadataValue}>
                            {ticketNumber || "-"}
                          </Text>
                          <Copy16Regular color="#ABABAD" width={12} height={12} style={styles.copyIcon} />
                        </Pressable>
                      </View>
                      <View style={styles.metadataCell}>
                        <Text style={styles.metadataLabel}>
                          {ticket.closedAt ? "办结时间" : "提交时间"}
                        </Text>
                        <Text style={styles.metadataValue}>
                          {formatTime(ticket.closedAt || ticket.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {!!(ticket.targetNickname || ticket.targetUid) &&
                      ticket.reasonType !== "ORDER_DISPUTE" && (
                        <View style={styles.target}>
                          <Text style={styles.metadataLabel}>投诉对象</Text>
                          <Text style={styles.metadataValue}>
                            {ticket.targetNickname || ticket.targetUid}
                          </Text>
                        </View>
                      )}
                  </View>
                  <View style={styles.evidence}>
                    <Text style={styles.body}>{ticket.content}</Text>
                    {images.length > 0 && (
                      <View
                        style={styles.images}
                        onLayout={(event) =>
                          setImageWidth(
                            Math.min(
                              62,
                              Math.max(
                                1,
                                (event.nativeEvent.layout.width - 16) / 5,
                              ),
                            ),
                          )
                        }
                      >
                        {images.map((uri, index) => (
                          <Pressable
                            key={`${uri}-${index}`}
                            accessibilityRole="button"
                            accessibilityLabel={`查看证据图片 ${index + 1}`}
                            onPress={() =>
                              router.push({
                                pathname: "/image-preview",
                                params: createImagePreviewParams(images, index),
                              })
                            }
                          >
                            <CachedImage
                              source={{ uri }}
                              contentFit="cover"
                              style={[
                                styles.image,
                                { width: imageWidth, height: imageWidth },
                              ]}
                            />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.officialSection}>
                  <Text style={styles.sectionTitle}>官方回复</Text>
                  {officialReplies.length ? (
                    officialReplies.map((content, index) => (
                      <Text key={index} style={styles.replyBody}>
                        {content}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.replyBody}>暂无官方回复</Text>
                  )}
                </View>
                {isMine && Boolean(ticket.messageList?.length) && (
                  <View style={styles.officialSection}>
                    <Text style={styles.sectionTitle}>
                      处理进度 · {statusText(ticket.status)}
                    </Text>
                    {(ticket.messageList ?? []).map((message, index) => (
                      <View
                        key={`${message.createdAt}-${index}`}
                        style={styles.message}
                      >
                        <Text style={styles.messageSender}>
                          {message.senderType === "ADMIN"
                            ? "平台客服"
                            : message.senderType === "SYSTEM"
                              ? "系统通知"
                              : "我"}
                        </Text>
                        <Text style={styles.body}>{message.content || ""}</Text>
                        <Text style={styles.messageTime}>
                          {formatTime(message.createdAt)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {isMine && ticket.status === "REJECTED" && (
                  <View style={styles.rejection}>
                    <Text style={styles.rejectionTitle}>驳回原因</Text>
                    <Text style={styles.body}>
                      {ticket.rejectionReason || "未填写驳回原因"}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(
                          `/court/complaint?mode=ticket&ticketId=${ticket.ticketId}`,
                        )
                      }
                      style={styles.resubmit}
                    >
                      <Text style={styles.resubmitText}>修改并重新提交</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          {isMine && ticket?.status === "TO_USER_REPLY" && (
            <View
              style={[
                styles.replyBox,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <TextInput
                value={reply}
                onChangeText={setReply}
                maxLength={1000}
                placeholder="补充说明"
                placeholderTextColor="#aaa"
                style={styles.replyInput}
                multiline
              />
              <Pressable
                accessibilityRole="button"
                disabled={!reply.trim() || submitting}
                onPress={sendReply}
                style={styles.send}
              >
                <Text style={styles.sendText}>
                  {submitting ? "提交中" : "发送"}
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function label(value?: string) {
  return (
    (
      {
        RULE_VIOLATION: "用户投诉",
        ORDER_DISPUTE: "订单存在纠纷",
        CHAT_DISPUTE: "用户投诉",
        OTHER: "用户投诉",
        PLATFORM_SUGGESTION: "平台建议",
      } as Record<string, string>
    )[value || ""] || "平台工单"
  );
}
function statusText(value?: string) {
  return (
    (
      {
        SUBMITTED: "已提交",
        REJECTED: "已驳回",
        PROCESSING: "处理中",
        TO_USER_REPLY: "待补充",
        RESOLVED: "已解决",
        CLOSED: "已关闭",
      } as Record<string, string>
    )[value || ""] || "处理中"
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
    height: 44,
    justifyContent: "center",
    width: 32,
  },
  backIcon: { height: 24, width: 24 },
  title: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  content: { paddingTop: 8, gap: 8 },
  summary: { backgroundColor: "#fff", padding: 16, gap: 16 },
  heading: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
    marginBottom: 8,
  },
  metadata: { gap: 8 },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  metadataCell: { flex: 1, minWidth: 0, flexDirection: "row", gap: 2 },
  metadataLabel: {
    color: "#979799",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 16,
    width: 48,
  },
  metadataValue: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  copyIcon: { width: 12, height: 12 },
  target: { flexDirection: "row", gap: 2 },
  evidence: { gap: 6 },
  body: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
  images: { flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: 326 },
  image: { borderRadius: 6, backgroundColor: "#F5F6F7" },
  officialSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  sectionTitle: {
    color: "#0D0D0F",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    paddingVertical: 4,
  },
  replyBody: {
    color: "#656566",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
  message: { gap: 6, paddingVertical: 8 },
  messageSender: {
    color: "#656566",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  messageTime: {
    color: "#979799",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 16,
  },
  rejection: { backgroundColor: "#fff", padding: 16, gap: 8 },
  rejectionTitle: {
    color: "#FE1F4C",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "600",
  },
  resubmit: {
    alignItems: "center",
    borderColor: "#FE1F4C",
    borderRadius: 8,
    borderWidth: 0.5,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resubmitText: {
    color: "#FE1F4C",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
  replyBox: {
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderTopColor: "#eee",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  replyInput: {
    backgroundColor: "#F5F6F7",
    borderRadius: 8,
    color: "#0D0D0F",
    flex: 1,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
    maxHeight: 90,
    minHeight: 42,
    padding: 10,
  },
  send: {
    alignItems: "center",
    backgroundColor: "#FE1F4C",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
  },
  sendText: { color: "#fff", fontFamily: COURT_FONT_FAMILY, fontSize: 14 },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
});
