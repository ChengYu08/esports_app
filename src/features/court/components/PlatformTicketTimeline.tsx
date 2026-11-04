import type { PlatformTicketTimelineMessage } from "@/features/court/platform-ticket-display";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { StyleSheet, Text, View } from "react-native";

export function PlatformTicketTimeline({ messages }: { messages: PlatformTicketTimelineMessage[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>消息时间线</Text>
      {messages.length === 0 ? (
        <Text style={styles.empty}>暂无消息记录</Text>
      ) : messages.map((message) => message.system ? (
        <View key={message.key} style={styles.systemMessage}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      ) : (
        <View key={message.key} style={[styles.message, message.alignRight && styles.rightMessage]}>
          <View style={[styles.senderRow, message.alignRight && styles.rightSenderRow]}>
            <Text style={styles.sender}>{message.sender}</Text>
            <Text style={styles.time}>{message.time}</Text>
          </View>
          <View style={[styles.bubble, message.alignRight && styles.userBubble]}>
            <Text style={styles.body}>{message.content}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#fff", padding: 16, gap: 12 },
  title: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 16, fontWeight: "600", lineHeight: 22 },
  empty: { color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 14, lineHeight: 22 },
  message: { alignItems: "flex-start", alignSelf: "flex-start", maxWidth: "88%", gap: 4 },
  rightMessage: { alignItems: "flex-end", alignSelf: "flex-end" },
  senderRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  rightSenderRow: { justifyContent: "flex-end" },
  sender: { color: "#656566", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "500", lineHeight: 18 },
  time: { color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 11, lineHeight: 18 },
  bubble: { backgroundColor: "#F5F6F7", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "100%" },
  userBubble: { backgroundColor: "#E8F4FF" },
  body: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 14, lineHeight: 22 },
  systemMessage: { alignSelf: "center", maxWidth: "100%", backgroundColor: "#F5F6F7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  systemText: { color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
