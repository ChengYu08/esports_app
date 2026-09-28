import assert from "node:assert/strict";
import test from "node:test";
import { createAuthSsoAdapter } from "./src/sso-adapter.ts";

test("password login sends username and password through the auth adapter", async () => {
  const calls = [];
  const client = {
    passwordLogin: async (username, password) => {
      calls.push({ username, password });
      return { access_token: "access-token" };
    },
  };

  const adapter = createAuthSsoAdapter(client);
  const token = await adapter.passwordLogin({
    username: "13800138000",
    password: "secret-password",
  });

  assert.equal(token.access_token, "access-token");
  assert.deepEqual(calls, [{
    username: "13800138000",
    password: "secret-password",
  }]);
});

test("forgot password adapter uses MOD SMS and forwards reset fields", async () => {
  const resetCodeCalls = [];
  const forgetCalls = [];
  const client = {
    getSmsCode: async (phone, smsTemplate) => {
      resetCodeCalls.push({ phone, smsTemplate });
    },
    forgetPassword: async (phone, smsCode, password) => {
      forgetCalls.push({ phone, smsCode, password });
    },
  };

  const adapter = createAuthSsoAdapter(client);
  await adapter.sendResetCode("13800138000");
  await adapter.forgetPassword({
    phone: "13800138000",
    code: "123456",
    password: "Abc123!@",
  });

  assert.deepEqual(resetCodeCalls, [
    { phone: "13800138000", smsTemplate: "MOD" },
  ]);
  assert.deepEqual(forgetCalls, [
    {
      phone: "13800138000",
      smsCode: "123456",
      password: "Abc123!@",
    },
  ]);
});
