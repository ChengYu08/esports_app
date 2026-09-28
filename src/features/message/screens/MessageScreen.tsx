import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageHeader } from "../components/MessageHeader";
import { MessageListItem } from "../components/MessageListItem";
import { MESSAGE_ITEMS } from "../message.data";
import type { MessageListItemModel } from "../message.types";

const doNothing = () => undefined;

export default function MessageScreen() {
  const insets = useSafeAreaInsets();

  const handleMessagePress = (_item: MessageListItemModel) => undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <MessageHeader onClear={doNothing} onSearch={doNothing} />
      <FlatList
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        data={MESSAGE_ITEMS}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MessageListItem
            item={item}
            isLast={index === MESSAGE_ITEMS.length - 1}
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
