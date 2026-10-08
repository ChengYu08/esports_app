import assert from "node:assert/strict";
import test from "node:test";

const { getPasswordLoginErrorMessage } = await import(
  new URL("./password-login-error.ts", import.meta.url).href
);

test("uses the server error message for a failed password login", () => {
  assert.equal(
    getPasswordLoginErrorMessage(new Error("账号或密码错误")),
    "账号或密码错误"
  );
});

test("uses a helpful fallback for an unknown password login failure", () => {
  assert.equal(
    getPasswordLoginErrorMessage(null),
    "请检查手机号和密码"
  );
});
