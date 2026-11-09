import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

/**
 * Android 边到边模式下 RN 的 keyboardDidShow 高度已减去底部系统栏
 * （ReactRootView 里 imeInsets.bottom - barInsets.bottom），但键盘实际
 * 遮挡到屏幕底，占位槽要补回 bottomInset，否则键盘会盖住 actions 图标行；
 * iOS 键盘高度本身已含底部安全区，不需要补偿
 */
const slotHeightForKeyboard = (
  keyboardHeight: number,
  bottomInset: number,
) => {
  if (keyboardHeight <= 0) {
    return 0;
  }
  if (Platform.OS === "android") {
    return keyboardHeight + bottomInset;
  }
  return keyboardHeight;
};

type VoiceRoomCommentPanelProps = {
  bottomInset: number;
  /** 输入草稿由父级持有：面板随键盘收起卸载后，再次打开时草稿不丢失 */
  draft: string;
  onDraftChange: (text: string) => void;
  onSendText: (text: string) => Promise<void>;
  onSendImage: (imageUri: string) => Promise<void>;
  /** 面板整体关闭（键盘与表情均收起） */
  onClose: () => void;
};

/** Figma 550:124041「评论-键盘拉起」：输入框聚焦弹起键盘时出现在键盘上方的白色输入面板 */
export function VoiceRoomCommentPanel({
  bottomInset,
  draft,
  onDraftChange,
  onSendText,
  onSendImage,
  onClose,
}: VoiceRoomCommentPanelProps) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // 键盘可见状态用 RN 键盘事件维护：keyboard-controller 的 useKeyboardState
  // 在程序化收起键盘（打开表情面板）时可能漏报 keyboardDidHide，
  // 状态滞留在「可见」会让面板永远无法关闭
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardVisibleRef = useRef(false);
  // 最近一次键盘高度：emoji 面板取同高，切换时输入条位置保持不动（微信式原地切换）
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /**
   * 底部占位槽：键盘态由键盘盖住（空槽）、emoji 态放同高的表情面板，
   * 两种状态槽高都恒等于键盘高度，切换时输入条全程原地不动。
   * 不用 KeyboardAvoidingView：它的 padding 动画会与槽高叠加成 2H，产生「顶起再砸下」的闪动
   */
  const [slotHeight] = useState(() => new Animated.Value(0));
  const lastKeyboardHeightRef = useRef(0);
  // 表情面板开关同步到 ref：键盘事件监听器只挂载一次，回调里读 ref 才能拿到最新值
  const emojiPickerOpenRef = useRef(false);
  useEffect(() => {
    emojiPickerOpenRef.current = emojiPickerOpen;
  }, [emojiPickerOpen]);
  // 程序化收起键盘前同步置位，吞掉紧随其后的 keyboardDidHide，避免误关面板。
  // ref 在同一 JS 任务内立即生效，事件回调读取时不存在与 setState 提交时序的竞态
  const suppressKeyboardHideCloseRef = useRef(false);
  // 表情面板打开时点击输入框：等键盘完全弹出（盖住面板）再卸载表情面板，
  // 避免面板先消失导致的输入条下沉再弹起
  const pendingEmojiCloseRef = useRef(false);

  // 键盘收起时整体关闭面板，回到「聊聊」假输入态。三种情况不关闭：
  // 1. 程序化收起（打开表情面板）；2. 表情面板展开中；
  // 3. 键盘本就处于收起状态时收到的迟到/重复 hide 事件
  //（表情面板打开时点击输入框重新聚焦，部分设备会先派发一条这种 hide 事件）
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event: { endCoordinates: { height: number } }) => {
        const height = event.endCoordinates.height;
        lastKeyboardHeightRef.current = height;
        // 槽高直接定格到键盘实际遮挡高度；表情→键盘切换时槽高本就是 H，输入条零位移
        slotHeight.setValue(slotHeightForKeyboard(height, bottomInset));
        keyboardVisibleRef.current = true;
        setKeyboardVisible(true);
        setKeyboardHeight(height);
        suppressKeyboardHideCloseRef.current = false;
        if (pendingEmojiCloseRef.current) {
          pendingEmojiCloseRef.current = false;
          setEmojiPickerOpen(false);
        }
      },
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      const wasVisible = keyboardVisibleRef.current;
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
      // 表情面板展开时键盘高度要冻结在 H（槽里是表情面板），不能清零
      if (!emojiPickerOpenRef.current) {
        slotHeight.setValue(0);
        setKeyboardHeight(0);
      }
      if (suppressKeyboardHideCloseRef.current) {
        suppressKeyboardHideCloseRef.current = false;
        return;
      }
      if (emojiPickerOpenRef.current) {
        return;
      }
      if (!wasVisible) {
        return;
      }
      onClose();
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [bottomInset, onClose, slotHeight]);

  // 表情面板打开时点输入框：槽高保持 H，等键盘弹出盖住后由 keyboardDidShow 卸载面板。
  // 全新聚焦（键盘未开）：预测性动画把槽高抬到上次键盘高度，与键盘升起动作同步；
  // 外接键盘等键盘不弹的场景由定时器兜底关闭
  const handleInputFocus = useCallback(() => {
    if (emojiPickerOpenRef.current) {
      pendingEmojiCloseRef.current = true;
      setTimeout(() => {
        if (pendingEmojiCloseRef.current) {
          pendingEmojiCloseRef.current = false;
          setEmojiPickerOpen(false);
        }
      }, 600);
      return;
    }
    if (!keyboardVisibleRef.current && lastKeyboardHeightRef.current > 0) {
      Animated.timing(slotHeight, {
        toValue: slotHeightForKeyboard(lastKeyboardHeightRef.current, bottomInset),
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [bottomInset, slotHeight]);

  // 切回键盘输入态：只聚焦输入框，表情面板由 keyboardDidShow 到达后卸载（槽高全程 H 不动）
  const closeEmojiToKeyboard = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const toggleEmojiPanel = useCallback(() => {
    if (emojiPickerOpen) {
      closeEmojiToKeyboard();
      return;
    }
    // 先置抑制标记再收键盘，keyboardDidHide 到达时标记已可见
    suppressKeyboardHideCloseRef.current = true;
    setEmojiPickerOpen(true);
    Keyboard.dismiss();
  }, [closeEmojiToKeyboard, emojiPickerOpen]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (emojiPickerOpen) {
          closeEmojiToKeyboard();
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
  }, [closeEmojiToKeyboard, emojiPickerOpen, keyboardVisible, onClose]);

  // 草稿镜像 ref：语聊房整屏很重，草稿更新触发的重渲染可能滞后于下一次点击，
  // 回调闭包里的 draft 会是过期值，快速连点 emoji 时会把上一次的选择覆盖掉。
  // 这里用 ref 同步读写最新草稿，点击追加不再依赖渲染快照
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const selectEmoji = useCallback(
    (emoji: EmojiType) => {
      const next = `${draftRef.current}${emoji.emoji}`;
      draftRef.current = next;
      onDraftChange(next);
    },
    [onDraftChange],
  );

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    draftRef.current = "";
    onDraftChange("");
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

  // 表情面板高度与键盘实际遮挡高度一致（未知时用旧默认值），保证切换时输入条原地不动
  const emojiPanelHeight =
    keyboardHeight > 0
      ? slotHeightForKeyboard(keyboardHeight, bottomInset)
      : 340 + bottomInset + 10;

  return (
    <View
      style={[
        styles.container,
        // 槽（键盘/表情面板）已顶到屏幕底，容器不再额外垫安全区
        { paddingBottom: emojiPickerOpen || keyboardHeight > 0 ? 0 : bottomInset },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.textArea}>
          <TextInput
            accessibilityLabel="语聊房消息输入"
            autoFocus
            multiline
            ref={inputRef}
            value={draft}
            onChangeText={onDraftChange}
            onFocus={handleInputFocus}
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
              onPress={toggleEmojiPanel}
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
      {/* 底部占位槽：键盘态为空白（键盘从下方滑入盖住），emoji 态放同高表情面板。
          槽高恒定 = 键盘高度，两种状态互切时输入条零位移 */}
      <Animated.View style={[styles.slot, { height: slotHeight }]}>
        {emojiPickerOpen ? (
          <View style={[styles.emojiPanel, { height: emojiPanelHeight }]}>
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
      </Animated.View>
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
  slot: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
});
