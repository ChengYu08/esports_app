import assert from "node:assert/strict";
import test from "node:test";
import {
  createForgetPasswordRequest,
  createPasswordLoginRequest,
} from "./src/password-requests.ts";

test("password login hashes the password and preserves OAuth fields", () => {
  assert.deepEqual(createPasswordLoginRequest("13800138000", "Abc123!@"), {
    path: "/api/auth/oauth2/token",
    data: {
      grant_type: "password",
      username: "13800138000",
      password: "26a50fcd25ddb09ca0eeb8e45c258668",
      scope: "openid",
    },
  });
});

test("forgot password hashes the new password and uses the public endpoint", () => {
  assert.deepEqual(
    createForgetPasswordRequest("13800138000", "123456", "Abc123!@"),
    {
      path: "/api/auth/public/common/forget-password",
      data: {
        phone: "13800138000",
        smsCode: "123456",
        password: "26a50fcd25ddb09ca0eeb8e45c258668",
      },
    },
  );
});
