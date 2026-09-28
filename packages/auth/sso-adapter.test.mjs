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
