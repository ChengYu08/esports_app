import { useLocalSearchParams } from "expo-router";

import { DispatchDetailScreen } from "@/features/order/screens/DispatchDetailScreen";

export default function DispatchDetailRoute() {
  const { requestNo } = useLocalSearchParams<{ requestNo: string }>();
  return <DispatchDetailScreen requestNo={requestNo} />;
}
