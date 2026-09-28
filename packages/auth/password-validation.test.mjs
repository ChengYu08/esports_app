import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeCode,
  sanitizePhone,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from "./src/password-validation.ts";

test("phone and code sanitizers keep only supported digits and lengths", () => {
  assert.equal(sanitizePhone("13a800-138000"), "13800138000");
  assert.equal(sanitizeCode("12a34567"), "123456");
});

test("phone validation requires a mainland China mobile number", () => {
  assert.equal(validatePhone(""), "请输入手机号");
  assert.equal(validatePhone("23800138000"), "请输入正确的手机号");
  assert.equal(validatePhone("13800138000"), null);
});

test("password validation enforces length whitespace and character classes", () => {
  assert.equal(validatePassword("Ab1!"), "密码长度为8-16位");
  assert.equal(validatePassword("Abc 123!"), "密码不允许有空格");
  assert.equal(
    validatePassword("abcdefgh"),
    "密码需包含特殊字符(如:%、&、#等)、大写字母、小写字母、数字中的三种或以上",
  );
  assert.equal(validatePassword("Abc123!@"), null);
});

test("password confirmation must be present and match", () => {
  assert.equal(
    validatePasswordConfirmation("Abc123!@", ""),
    "请再次输入新密码",
  );
  assert.equal(
    validatePasswordConfirmation("Abc123!@", "Abc123!#"),
    "两次输入的密码不一致",
  );
  assert.equal(
    validatePasswordConfirmation("Abc123!@", "Abc123!@"),
    null,
  );
});
