import { router } from "expo-router";

import OrderScreen from "@/features/order/screens/OrderScreen";

export default function OrderListRoute() {
  return <OrderScreen onBack={() => router.back()} />;
}
