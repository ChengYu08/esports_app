import test from "node:test";
import assert from "node:assert/strict";

import { getOrderDetailAction } from "./order-detail-actions.ts";

test("uses after-sales for completed orders", () => {
  assert.equal(
    getOrderDetailAction([
      { key: "afterSales", label: "售后", variant: "secondary" },
      { key: "review", label: "评价", variant: "secondary" },
    ]),
    "afterSales",
  );
});

test("uses cancel for in-progress orders with a cancel card action", () => {
  assert.equal(
    getOrderDetailAction([
      { key: "cancel", label: "取消订单", variant: "secondary" },
    ]),
    "cancel",
  );
});

test("hides the detail action when the card has no actions", () => {
  assert.equal(getOrderDetailAction([]), null);
});
