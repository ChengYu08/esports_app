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

test("updates profile using the PC account settings endpoint", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return { success: true, code: "SUCCESS", data: { id: 42, nickname: "新昵称", headImage: "" } };
  });

  const result = await api.updateProfile("business-token", { nickname: "新昵称" });

  assert.equal(result.nickname, "新昵称");
  assert.deepEqual(requests, [{
    path: "/client/v1/user/update/profile",
    options: { method: "POST", token: "business-token", body: { action: { nickname: "新昵称" } } },
  }]);
});

test("verifies real name and logs out with the business token", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return { success: true, code: "SUCCESS", data: true };
  });

  await api.realNameVerify("business-token", { name: "测试", num: "110101199001011234" });
  await api.logout("business-token");

  assert.deepEqual(requests, [
    { path: "/client/v1/user/elementSmartVerify", options: { method: "POST", token: "business-token", body: { action: { name: "测试", num: "110101199001011234" } } } },
    { path: "/client/v1/user/logout", options: { method: "POST", token: "business-token" } },
  ]);
});

test("checks account cancellation status and returns blocking reasons", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return {
      success: true,
      code: "SUCCESS",
      data: ["存在未完成订单", "还有待处理的售后"],
    };
  });

  const reasons = await api.checkAccountCancellation("business-token");

  assert.deepEqual(reasons, ["存在未完成订单", "还有待处理的售后"]);
  assert.deepEqual(requests, [{
    path: "/h5-client/v2/user/write/off/check",
    options: { method: "POST", token: "business-token", body: { action: {} }, signed: true },
  }]);
});

test("sends cancellation sms and submits the verified cancellation request", async () => {
  const requests = [];
  const api = createClientAuthContract(async (path, options) => {
    requests.push({ path, options });
    return { success: true, code: "SUCCESS", data: true };
  });

  await api.sendAccountCancellationSms("business-token");
  await api.cancelAccount("business-token", "123456");

  assert.deepEqual(requests, [
    {
      path: "/h5-client/v2/common/sms",
      options: {
        method: "POST",
        token: "business-token",
        body: { action: { smsTemplate: "WRITE_OFF" } },
        signed: true,
      },
    },
    {
      path: "/h5-client/v2/user/write/off",
      options: {
        method: "POST",
        token: "business-token",
        body: { action: { smsCode: "123456" } },
        signed: true,
      },
    },
  ]);
});
