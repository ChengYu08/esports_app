import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { OrderCard } from "../components/OrderCard";
import { OrderHeader } from "../components/OrderHeader";
import { OrderTabs } from "../components/OrderTabs";
import { ORDER_ITEMS } from "../order.data";
import { filterOrders } from "../order.filter";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

const EMPTY_LABELS: Record<OrderFilter, string> = {
  all: "暂无订单",
  inProgress: "暂无进行中订单",
  completed: "暂无已完成订单",
  cancelled: "暂无已取消订单",
};

const handleOrderAction = (
  _item: OrderItemModel,
  _action: OrderActionKey,
) => undefined;

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useMemo(() => filterOrders(ORDER_ITEMS, filter), [filter]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OrderHeader />
      <OrderTabs onChange={setFilter} value={filter} />
      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        data={orders}
        ItemSeparatorComponent={OrderSeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{EMPTY_LABELS[filter]}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard item={item} onAction={handleOrderAction} onPress={(order) => router.push(`/order/${order.id}`)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function OrderSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { flexGrow: 1, paddingTop: 8 },
  separator: { height: 8 },
  empty: { flex: 1, minHeight: 320, alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 14,
    lineHeight: 22,
  },
});
