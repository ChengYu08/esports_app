import { Image } from "expo-image";
import { router } from "expo-router";
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import { useCallback, useEffect, useRef, useState } from "react";

import { convertToJpeg } from "@/shared/media-picker/image-compat";
import { beginMediaPick } from "@/shared/media-picker/media-picker-session";
import { showToast } from "@/shared/ui/app-toast";

const emojiIcon = require("../../../../assets/svgs/chat-emoji.svg");
const photoIcon = require("../../../../assets/svgs/chat-photo.svg");
const sendIcon = require("../../../../assets/svgs/chat-send.svg");

/** 与 ChatScreen 聊天图片一致：单次最多选 10 张 */
const IMAGE_MAX = 10;

type VoiceRoomCommentPanelProps = {
  bottomInset: number;
  onSendText: (text: string) => Promise<void>;
  onSendImage: (imageUri: string) => Promise<void>;
  /** 面板整体关闭（键盘与表情均收起） */
  onClose: () => void;
};

/** Figma 550:124041「评论-键盘拉起」：输入框聚焦弹起键盘时出现在键盘上方的白色输入面板 */
export function VoiceRoomCommentPanel({
  bottomInset,
  onSendText,
  onSendImage,
  onClose,
}: VoiceRoomCommentPanelProps) {
  const [draft, setDraft] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardEverVisibleRef = useRef(false);
  useEffect(() => {
    if (keyboardVisible) {
      keyboardEverVisibleRef.current = true;
    }
  }, [keyboardVisible]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (emojiPickerOpen) {
          setEmojiPickerOpen(false);
          return true;
        }
        // 键盘已收但面板仍展开（键盘状态事件丢失的兜底）：直接关闭面板
        if (!keyboardVisible) {
          onClose();
          return true;
        }
        // 键盘可见时交给系统收起键盘，随后由键盘事件联动关闭面板
        return false;
      },
    );
    return () => subscription.remove();
  }, [emojiPickerOpen, keyboardVisible, onClose]);

  // 键盘收起且表情面板未展开时整体关闭面板，回到「聊聊」假输入态。
  // autoFocus 触发键盘弹出存在延迟，用「键盘至少弹出过一次」守卫，避免挂载瞬间误关。
  useEffect(() => {
    if (!keyboardVisible && !emojiPickerOpen && keyboardEverVisibleRef.current) {
      onClose();
    }
  }, [emojiPickerOpen, keyboardVisible, onClose]);

  // iOS 无物理返回键，键盘状态事件若丢失面板会卡在展开态；
  // 以原生 keyboardDidHide 事件作为第二通道兜底（两端均生效）
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      if (emojiPickerOpen) return;
      onClose();
    });
    return () => subscription.remove();
  }, [emojiPickerOpen, onClose]);

  const selectEmoji = useCallback((emoji: EmojiType) => {
    setDraft((current) => `${current}${emoji.emoji}`);
  }, []);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSendText(text);
  };

  const pickImage = async () => {
    Keyboard.dismiss();
    // 选图会跳转相册页并收起键盘，这里直接确定性关闭面板，
    // 发送结果经 onSendImage 回传插入消息列表，不依赖键盘状态事件
    onClose();
    // 相册选择页内部处理权限，选图结果经会话桥接回传；上限 10 张防止刷屏
    const pickPending = beginMediaPick();
    router.push({
      pathname: "/media-picker",
      params: { max: String(IMAGE_MAX) },
    });
    const picked = await pickPending;
    if (!picked?.length) return;

    let failed = 0;
    // 逐张发送保持顺序；统一重编码为 JPEG，规避 HEIC 原图与超大原图直接发送
    for (const uri of picked) {
      try {
        const sendUri = await convertToJpeg(uri);
        await onSendImage(sendUri);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      showToast(`${failed}张图片发送失败，请重试`);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
      <View style={styles.content}>
        <View style={styles.textArea}>
          <TextInput
            accessibilityLabel="语聊房消息输入"
            autoFocus
            multiline
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setEmojiPickerOpen(false)}
            placeholder="这是一段输入文本"
            placeholderTextColor="#CCCCCC"
            maxLength={1000}
            cursorColor="#FE1F4C"
            selectionColor="#FE1F4C"
            style={styles.input}
          />
        </View>
        <View style={styles.actions}>
          <View style={styles.tools}>
            <Pressable
              accessibilityLabel="表情"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                Keyboard.dismiss();
                setEmojiPickerOpen((current) => !current);
              }}
              style={styles.toolButton}
            >
              <Image source={emojiIcon} style={styles.toolIcon} contentFit="contain" />
            </Pressable>
            <Pressable
              accessibilityLabel="图片"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void pickImage()}
              style={styles.toolButton}
            >
              <Image source={photoIcon} style={styles.toolIcon} contentFit="contain" />
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel="发送消息"
            accessibilityRole="button"
            disabled={!draft.trim()}
            onPress={() => void sendMessage()}
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendText}>发送</Text>
            <Image source={sendIcon} style={styles.sendIcon} contentFit="contain" />
          </Pressable>
        </View>
      </View>
      {emojiPickerOpen ? (
        <View style={[styles.emojiPanel, { height: 340 + bottomInset + 10 }]}>
          <EmojiKeyboard
            categoryPosition="bottom"
            disableSafeArea
            enableRecentlyUsed
            hideHeader
            onEmojiSelected={selectEmoji}
            styles={{
              container: {
                paddingBottom: bottomInset + 10,
                borderRadius: 0,
                elevation: 0,
                shadowOpacity: 0,
              },
            }}
            theme={{
              container: "#FFFFFF",
              header: "#333333",
              category: { icon: "#999999", iconActive: "#FE1F4C" },
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  /** Figma 550:124055：comment area 内边距 12/12/8，行间距 8 */
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  /** Figma 550:124056：输入区灰底 #F7F7F7、圆角 8 */
  textArea: {
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  input: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 0,
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  toolButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  toolIcon: { width: 24, height: 24 },
  /** Figma 550:124061：品牌红胶囊发送按钮，高 24、水平内边距 12 */
  sendButton: {
    height: 24,
    borderRadius: 999,
    backgroundColor: "#FE1F4C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
  },
  sendIcon: { width: 14, height: 14 },
  emojiPanel: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
});
