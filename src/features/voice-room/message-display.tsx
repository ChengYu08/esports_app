import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createImagePreviewParams } from "@/features/mine/image-preview.params";

import type { VoiceRoomMemberRole, VoiceRoomMessage } from "./voice-room.types";

export function MessageRoleTag({ role }: { role?: VoiceRoomMemberRole }) {
  if (role === "service") {
    return (
      <View style={[styles.msgRoleTag, styles.msgRoleTagService]}>
        <Text style={styles.msgRoleTagText}>接待</Text>
      </View>
    );
  }
  if (role === "player") {
    return (
      <View style={[styles.msgRoleTag, styles.msgRoleTagPlayer]}>
        <Text style={styles.msgRoleTagText}>陪玩</Text>
      </View>
    );
  }
  return null;
}

export function displayMessage(
  message: VoiceRoomMessage,
  memberRole?: VoiceRoomMemberRole,
) {
  if (message.kind === "notice") {
    return (
      <View style={styles.noticeBubble}>
        <Text style={styles.noticeText}>{message.text}</Text>
      </View>
    );
  }
  if (message.kind === "system") {
    return (
      <View style={styles.systemBubble}>
        {message.nickname ? (
          <Text style={styles.systemName}>{message.nickname}</Text>
        ) : null}
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }
  const name = message.nickname || "用户";
  return (
    <View style={styles.chatBubble}>
      <View style={styles.chatInline}>
        <MessageRoleTag role={memberRole} />
        <Text style={styles.chatName}>{`${name}：`}</Text>
        {message.imageUrl ? null : (
          <Text style={styles.chatBody}>{message.text}</Text>
        )}
      </View>
      {message.imageUrl ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="查看图片"
          onPress={() =>
            router.push({
              pathname: "/image-preview",
              params: createImagePreviewParams([message.imageUrl as string], 0),
            })
          }
        >
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.messageImage}
            contentFit="cover"
            transition={120}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export const messageKeyExtractor = (item: VoiceRoomMessage) => item.id;

const styles = StyleSheet.create({
  noticeBubble: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noticeText: {
    color: "#55C9D4",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  systemBubble: {
    alignSelf: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  systemName: {
    color: "#55C9D4",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  systemText: {
    color: "#979799",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  chatBubble: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chatInline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  chatName: {
    color: "#55C9D4",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  chatBody: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    flexShrink: 1,
  },
  msgRoleTag: {
    borderRadius: 52,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  msgRoleTagService: { backgroundColor: "#B81636" },
  msgRoleTagPlayer: { backgroundColor: "#1540AD" },
  msgRoleTagText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "600",
    lineHeight: 12,
  },
  messageImage: {
    width: 80,
    height: 73,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#49494A",
  },
});
