import assert from "node:assert/strict";
import test from "node:test";
import { createClientAuthContract } from "./client-auth.contract.ts";

test("exchanges SSO id token using the C端 envelope and returns the business token", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return { success: true, code: "SUCCESS", info: "操作成功", data: { token: "business-token", register: false } };
  });

  const result = await api.exchangeIdToken("sso-id-token", "SMS_CODE");

  assert.deepEqual(result, { token: "business-token", register: false });
  assert.deepEqual(requests, [{
    path: "/client/v1/user/public/login/idtoken",
    options: {
      method: "POST",
      body: { action: { idToken: "sso-id-token", registerWay: "SMS_CODE" } },
    },
  }]);
});

test("loads the current C端 user with the business token header", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return {
      success: true,
      code: "SUCCESS",
      info: "操作成功",
      data: { id: 42, nickname: "小明", headImage: "avatar.png", phone: "138****0000", gender: 1 },
    };
  });

  const result = await api.fetchCurrentUser("business-token");

  assert.equal(result.id, 42);
  assert.deepEqual(requests, [{
    path: "/client/v1/user/login/info",
    options: { method: "POST", token: "business-token" },
  }]);
});
