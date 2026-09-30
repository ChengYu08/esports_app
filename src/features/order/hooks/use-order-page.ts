import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@esports/auth";
import { fetchOrderPage } from "../order.api";
import type { OrderFilter } from "../order.types";

export function useOrderPage(filter: OrderFilter) {
  const token = useAuthStore((state) => state.accessToken);
  const buyerUserId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["orders", filter, buyerUserId],
    queryFn: () => fetchOrderPage(filter, token as string, buyerUserId as string),
    enabled: Boolean(token && buyerUserId),
  });
}
