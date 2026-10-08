import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@esports/auth";

import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import { MESSAGE_ITEMS } from "../message.data";
import type { MessageListItemModel } from "../message.types";
import { connectRongCloud, getRongConversations, subscribeRongMessages } from "../rongcloud-im";

const defaultConversationAvatar = require("../../../../assets/message/avatar-wangzhe.svg");

const doNothing = () => undefined;

export default function MessageScreen() {
  const insets = useSafeAreaInsets();

  const accessToken = useAuthStore((state) => state.accessToken);
  const [remoteItems, setRemoteItems] = useState<MessageListItemModel[]>([]);
  const [imReady, setImReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!accessToken) return () => { active = false; };
    void connectRongCloud(accessToken).then(async (ok) => {
      if (!ok || !active) return;
      const items = await getRongConversations();
      if (active) {
        setRemoteItems(items.map((item) => ({ ...item, kind: "conversation", avatar: item.avatar || defaultConversationAvatar })));
        setImReady(true);
      }
    }).catch(() => { if (active) setImReady(false); });
    return subscribeRongMessages((item) => {
      setRemoteItems((current) => [{ ...item, kind: "conversation", avatar: item.avatar || defaultConversationAvatar }, ...current.filter((x) => x.id !== item.id)]);
    });
  }, [accessToken]);

  const items = useMemo(() => imReady ? remoteItems : MESSAGE_ITEMS, [imReady, remoteItems]);
  const handleMessagePress = (_item: MessageListItemModel) => undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <MessageHeader onClear={doNothing} onSearch={doNothing} />
      <FlatList
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MessageListItem
            item={item}
            isLast={index === items.length - 1}
            onPress={handleMessagePress}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
});
