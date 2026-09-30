import type { CompanionOrderContext, CompanionServiceOption } from "./companion-order.types";

export function buildCreateOrderAction(
  context: CompanionOrderContext,
  service: CompanionServiceOption,
  quantity: number,
  remark: string,
) {
  const normalizedQuantity = Math.max(1, Math.floor(quantity));
  return {
    serviceUserId: context.serviceUserId,
    clubId: context.clubId,
    gameId: context.gameId,
    companionId: service.companionServiceId,
    price: service.price,
    quantity: normalizedQuantity,
    total: service.price * normalizedQuantity,
    ...(remark.trim() ? { remark: remark.trim() } : {}),
    buyerUserId: context.buyerUserId,
    orderType: "COMPANION" as const,
    orderSource: "USER" as const,
  };
}
