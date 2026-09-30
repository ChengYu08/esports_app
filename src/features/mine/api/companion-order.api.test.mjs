import test from "node:test";
import assert from "node:assert/strict";

import { buildCreateOrderAction } from "./companion-order.payload.ts";

test("builds the client order payload from the locked game service", () => {
  const action = buildCreateOrderAction(
    {
      serviceUserId: 50100045,
      clubId: 1000003,
      gameId: 8,
      gameLevelId: 36,
      gameModeName: "排位",
      gameLevelName: "黄金",
      buyerUserId: 1001,
    },
    { companionServiceId: 103, name: "168保1288w", price: 1681 },
    2.8,
    "晚上开黑",
  );

  assert.deepEqual(action, {
    serviceUserId: 50100045,
    clubId: 1000003,
    gameId: 8,
    companionId: 103,
    price: 1681,
    quantity: 2,
    total: 3362,
    remark: "晚上开黑",
    buyerUserId: 1001,
    orderType: "COMPANION",
    orderSource: "USER",
  });
});
