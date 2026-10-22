import {
  courtApi,
  formatTime,
  type PlatformTicket,
} from "@/features/court/court.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
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
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isMine = mine === "1";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTicket(await courtApi.getTicketDetail(id, isMine));
    } catch (error) {
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
    if (!reply.trim() || !ticket?.ticketId || submitting) return;
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
        <Text style={styles.title}>工单详情</Text>
        <View style={styles.back} />
      </View>
      {loading && !ticket ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff3158" />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {ticket && (
              <>
                <View style={styles.summary}>
                  <View style={styles.row}>
                    <Text style={styles.ticketNo}>
                      工单 {ticket.ticketNo || ticket.ticketId}
                    </Text>
                    <Text style={styles.status}>
                      {statusText(ticket.status)}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {label(ticket.reasonType)}　·　
                    {formatTime(ticket.createdAt)}
                  </Text>
                  {!!ticket.targetNickname && (
                    <View style={styles.target}>
                      <CachedImage
                        source={
                          ticket.targetAvatar
                            ? { uri: ticket.targetAvatar }
                            : undefined
                        }
                        style={styles.avatar}
                      />
                      <Text style={styles.targetText}>
                        {ticket.targetNickname}　ID:{ticket.targetUid}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.sectionTitle}>投诉内容</Text>
                  <Text style={styles.body}>{ticket.content}</Text>
                  {!!ticket.evidenceThumbnails?.length && (
                    <View style={styles.images}>
                      {ticket.evidenceThumbnails.map((uri, index) => (
                        <CachedImage
                          key={`${uri}-${index}`}
                          source={{ uri }}
                          style={styles.image}
                        />
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.threadTitle}>处理进度</Text>
                {(ticket.messageList ?? []).map((message, index) => (
                  <View
                    key={`${message.createdAt}-${index}`}
                    style={[
                      styles.message,
                      message.senderType === "USER" && styles.userMessage,
                    ]}
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
                {!!ticket.adminReply && !ticket.messageList?.length && (
                  <View style={styles.message}>
                    <Text style={styles.messageSender}>平台客服</Text>
                    <Text style={styles.body}>{ticket.adminReply}</Text>
                    <Text style={styles.messageTime}>
                      {formatTime(ticket.repliedAt)}
                    </Text>
                  </View>
                )}
                {ticket.status === "REJECTED" && (
                  <View style={styles.rejection}>
                    <Text style={styles.rejectionTitle}>驳回原因</Text>
                    <Text style={styles.body}>
                      {ticket.rejectionReason || "未填写驳回原因"}
                    </Text>
                    <Pressable
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
        RULE_VIOLATION: "违反平台规定",
        ORDER_DISPUTE: "订单纠纷",
        CHAT_DISPUTE: "聊天纠纷",
        OTHER: "其他",
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
  summary: { backgroundColor: "#fff", borderRadius: 8, padding: 12 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ticketNo: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    backgroundColor: "#fff0e7",
    borderRadius: 12,
    color: "#e47928",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  meta: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 10, marginTop: 8 },
  target: {
    alignItems: "center",
    backgroundColor: "#fafafa",
    flexDirection: "row",
    marginTop: 10,
    padding: 8,
  },
  avatar: { backgroundColor: "#eee", borderRadius: 16, height: 32, width: 32 },
  targetText: {
    color: "#555",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    marginLeft: 8,
  },
  sectionTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
  },
  body: {
    color: "#444",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  images: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  image: { borderRadius: 5, height: 58, width: 58 },
  threadTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  message: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  userMessage: { borderColor: "#ffdae1", borderWidth: 1 },
  messageSender: {
    color: "#e77b25",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    fontWeight: "600",
  },
  messageTime: {
    color: "#aaa",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    marginTop: 7,
  },
  rejection: {
    backgroundColor: "#fff4f5",
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  rejectionTitle: {
    color: "#e3425a",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "600",
  },
  resubmit: {
    alignItems: "center",
    borderColor: "#ff3158",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 9,
  },
  resubmitText: { color: "#ff3158", fontFamily: DOUYIN_SANS, fontSize: 12 },
  replyBox: {
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderTopColor: "#eee",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  replyInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    color: "#333",
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    maxHeight: 90,
    minHeight: 42,
    padding: 10,
  },
  send: {
    alignItems: "center",
    backgroundColor: "#ff3158",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  sendText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 12 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
});
