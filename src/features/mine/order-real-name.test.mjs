import assert from "node:assert/strict";
import test from "node:test";

import {
  handleOrderFailurePromptConfirm,
  requiresRealNameVerification,
} from "./order-real-name.ts";

test("recognizes the companion real-name verification failure returned by order creation", () => {
  assert.equal(requiresRealNameVerification("陪玩未进行实名认证"), true);
});

test("does not offer real-name verification for unrelated order failures", () => {
  assert.equal(requiresRealNameVerification("当前服务不可用，请稍后重试"), false);
});

test("dismisses the order sheet before opening account settings for real-name verification", () => {
  const events = [];

  handleOrderFailurePromptConfirm("陪玩未进行实名认证", {
    dismissPrompt: () => events.push("prompt"),
    dismissSheet: (afterClose) => {
      events.push("sheet");
      afterClose?.();
    },
    openVerification: () => events.push("settings"),
  });

  assert.deepEqual(events, ["prompt", "sheet", "settings"]);
});
