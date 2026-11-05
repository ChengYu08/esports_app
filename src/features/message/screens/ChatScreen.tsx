import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { ChatConversation } from "../components/ChatConversation";

export default function ChatScreen() {
  const {
    id,
    title,
    avatar,
    clubId,
    afterSale,
    customerService,
    fromProfile,
  } = useLocalSearchParams<{
    id?: string;
    title?: string;
    avatar?: string;
    clubId?: string;
    afterSale?: string;
    customerService?: string;
    fromProfile?: string;
  }>();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <ChatConversation
      active={focused}
      afterSale={afterSale}
      avatar={avatar}
      clubId={clubId}
      conversationId={String(id || "")}
      customerService={customerService}
      fromProfile={fromProfile}
      presentation="page"
      title={title}
    />
  );
}
