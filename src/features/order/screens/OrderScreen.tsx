import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { OrderCard } from "../components/OrderCard";
import { OrderHeader } from "../components/OrderHeader";
import { OrderTabs } from "../components/OrderTabs";
import { useOrderPage } from "../hooks/use-order-page";
import type {
  OrderActionKey,
  OrderFilter,
  OrderItemModel,
} from "../order.types";

const handleOrderAction = (
  _item: OrderItemModel,
  _action: OrderActionKey,
) => undefined;

export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useOrderPage(filter);
  const items = orders.data?.items ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OrderHeader />
      <OrderTabs onChange={setFilter} value={filter} />
      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        data={items}
        ItemSeparatorComponent={OrderSeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={orders.isLoading ? <LoadingState /> : orders.isError ? <ErrorState onRetry={() => void orders.refetch()} /> : <View style={styles.empty}><EmptyState message={filter === "all" ? "暂无订单" : `暂无${filter === "inProgress" ? "进行中" : filter === "completed" ? "已完成" : "已取消"}订单`} /></View>}
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
});
