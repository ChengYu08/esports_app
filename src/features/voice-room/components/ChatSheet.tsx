import { useRef, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";

import { ChatConversation } from "@/features/message/components/ChatConversation";
import { BottomSheet } from "@/shared/ui/BottomSheet";

export type ChatSheetConversation = {
  id: string;
  title: string;
  avatar?: string;
  clubId?: string;
};

type ChatSheetProps = {
  /** 非 null 时从底部拉起；关闭退场动画期间保留最后内容，避免白板下滑 */
  conversation: ChatSheetConversation | null;
  /** 头部返回 / 安卓返回键：回到消息列表弹窗（表情面板打开时只收面板） */
  onBack: () => void;
  /** 头部 ×：弹窗整体关闭回开黑房 */
  onClose: () => void;
  /** 跳转原生路由前收起弹窗（选图/主页/订单/图片预览），restorable=返回后可恢复 */
  onBeforeNavigate: (restorable: boolean) => void;
  /** 相册选图结束后重新拉起弹窗 */
  onAfterPickImages: () => void;
};

/** 开黑房内从底部拉起的私聊弹窗，复用 message 领域的 ChatConversation。 */
export function ChatSheet({
  conversation,
  onBack,
  onClose,
  onBeforeNavigate,
  onAfterPickImages,
}: ChatSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [lastConversation, setLastConversation] =
    useState<ChatSheetConversation | null>(conversation);
  // 表情面板打开时由 ChatComposer 注册，返回键先收面板再考虑关弹窗
  const backInterceptorRef = useRef<(() => boolean) | null>(null);

  // 关闭退场动画期间保留最后内容，避免白板下滑；渲染期同步新会话
  if (conversation && conversation !== lastConversation) {
    setLastConversation(conversation);
  }

  const current = conversation ?? lastConversation;
  if (!current) return null;

  // 设计稿（1829-78203）弹层高 690/812 ≈ 85% 屏高
  return (
    <BottomSheet
      visible={Boolean(conversation)}
      keyboardAvoiding
      onClose={onClose}
      onRequestClose={() => {
        if (backInterceptorRef.current?.()) return;
        onBack();
      }}
      contentStyle={[styles.sheet, { height: Math.round(windowHeight * 0.85) }]}
    >
      <ChatConversation
        key={current.id}
        active={Boolean(conversation)}
        avatar={current.avatar}
        backInterceptorRef={backInterceptorRef}
        clubId={current.clubId}
        conversationId={current.id}
        onAfterPickImages={onAfterPickImages}
        onBack={onBack}
        onBeforeNavigate={onBeforeNavigate}
        onClose={onClose}
        presentation="sheet"
        title={current.title}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#F5F6F7",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
});
