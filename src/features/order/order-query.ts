import { queryClient } from "@/core/query/query-client";
import type { InfiniteData } from "@tanstack/react-query";
import { fetchOrderDetail, mapOrder } from "./order.api";
import type { OrderFilter, OrderItemModel } from "./order.types";

export function orderDetailQueryKey(
  orderId: string | number,
  scope?: "accept" | "place",
) {
  return scope
    ? (["order-detail", String(orderId), scope] as const)
    : (["order-detail", String(orderId)] as const);
}

export async function invalidateOrderQueries(orderId?: string | number) {
  await queryClient.invalidateQueries({
    queryKey: ["orders"],
    refetchType: "active",
  });
  if (orderId !== undefined) {
    await queryClient.invalidateQueries({
      queryKey: orderDetailQueryKey(orderId),
      refetchType: "none",
    });
  }
}

/**
 * 陪玩侧的状态变更（接单/开始/完成等）通过融云 ORDER_NOTIFY 推送到用户端；
 * 收到即失效并立即重拉当前激活的订单列表与详情，避免详情页停留在旧状态。
 * orderIds 需同时传订单 id 与单号：详情缓存 key 是数字 id，而通知可能只带单号。
 */
export async function refreshOrdersForRemoteChange(
  orderIds: readonly (string | number)[] = [],
) {
  await queryClient.invalidateQueries({
    queryKey: ["orders"],
    refetchType: "active",
  });
  const seen = new Set<string>();
  for (const orderId of orderIds) {
    const key = String(orderId);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await queryClient.invalidateQueries({
      queryKey: orderDetailQueryKey(key),
      refetchType: "active",
    });
  }
}

/**
 * 收到抢单通知 / 需求结束信号后失效派单中心「正在抢单」：可见时立即重拉，
 * 不可见则标记 stale，下次进入派单中心自动拉取（对齐 PC 打开抽屉即 reload）。
 */
export async function refreshDispatchForRemoteChange() {
  await queryClient.invalidateQueries(
    {
      queryKey: ["orders", "dispatch", "grabbing"],
      refetchType: "active",
    },
    { cancelRefetch: false },
  );
}

/** 一次抢单结算（成功或失败）后失效派单中心两个列表：「正在抢单」与「抢单记录」。 */
export async function refreshDispatchAfterGrabAttempt() {
  await queryClient.invalidateQueries(
    {
      queryKey: ["orders", "dispatch"],
      refetchType: "active",
    },
    { cancelRefetch: false },
  );
}

/** 抢单结算后失效该需求的派单详情，详情页开着时同步为已抢单/已失效状态。 */
export async function refreshDispatchDetail(requestNo: string) {
  await queryClient.invalidateQueries(
    {
      queryKey: ["dispatch-detail", requestNo],
      refetchType: "active",
    },
    { cancelRefetch: false },
  );
}

/** 订单真实状态 → 列表筛选（与后端 qryStatus 对齐，Web 端 toQryStatus 同源）。 */
function statusFilterOf(
  status: OrderItemModel["status"],
): OrderFilter | undefined {
  if (
    status === "pendingPayment" ||
    status === "paid" ||
    status === "waitingService" ||
    status === "inService"
  ) {
    return "inProgress";
  }
  if (status === "completed" || status === "partiallyRefunded") {
    return "completed";
  }
  if (status === "cancelled" || status === "refunded") return "cancelled";
  return undefined;
}

/**
 * 接单/拒绝/开始等订单操作后以详情为准就地刷新列表（对齐 Web 的 softRefreshOrder）：
 * 分页列表接口此时可能仍返回旧状态，先失效重拉，再用 getDetail 的结果替换缓存中的该单；
 * 「进行中/已完成/已取消」筛选下的列表按新状态决定该单去留，避免卡片与筛选不符。
 */
export async function refreshOrderAfterAction(
  orderId: string,
  token: string,
  userId: string,
) {
  await invalidateOrderQueries(orderId);
  const raw = await fetchOrderDetail(orderId, token);
  const keys = queryClient.getQueryCache().findAll({ queryKey: ["orders"] });
  for (const { queryKey } of keys) {
    const [, scope, filter, accountId] = queryKey;
    if (accountId !== userId || (scope !== "accept" && scope !== "place"))
      continue;
    const updated = mapOrder(raw, 0, scope);
    const statusFilter = statusFilterOf(updated.status);
    queryClient.setQueryData<
      InfiniteData<{ items: OrderItemModel[]; hasMore: boolean }>
    >(queryKey, (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items
            .filter((item) => {
              if (item.id !== orderId) return true;
              return filter === "all" || statusFilter === filter;
            })
            .map((item) => (item.id === orderId ? updated : item)),
        })),
      };
    });
  }
}
