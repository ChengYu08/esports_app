import { useLocalSearchParams } from "expo-router";

import { OrderDetailScreen } from "@/features/order/screens/OrderDetailScreen";
import type { OrderScope } from "@/features/order/order.types";

export default function OrderDetailRoute() {
  const { id, scope: scopeParam } = useLocalSearchParams<{
    id: string;
    scope?: string;
  }>();
  const scope: OrderScope = scopeParam === "accept" ? "accept" : "place";
  return <OrderDetailScreen id={id} scope={scope} />;
}
