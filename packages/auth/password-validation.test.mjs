import assert from "node:assert/strict";
import test from "node:test";
import * as passwordValidation from "./src/password-validation.ts";
import {
  sanitizeCode,
  sanitizePhone,
  validateForgotPasswordForm,
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

test("forgot password form validates fields in submission order", () => {
  const validForm = {
    phone: "13800138000",
    code: "123456",
    password: "Abc123!@",
    confirmation: "Abc123!@",
  };

  assert.equal(
    validateForgotPasswordForm({ ...validForm, phone: "" }),
    "请输入手机号",
  );
  assert.equal(
    validateForgotPasswordForm({ ...validForm, code: "" }),
    "请输入验证码",
  );
  assert.equal(
    validateForgotPasswordForm({ ...validForm, password: "short" }),
    "密码长度为8-16位",
  );
  assert.equal(
    validateForgotPasswordForm({ ...validForm, confirmation: "Abc123!#" }),
    "两次输入的密码不一致",
  );
  assert.equal(validateForgotPasswordForm(validForm), null);
});

test("login button becomes ready only when the active form is complete", () => {
  assert.equal(
    passwordValidation.isLoginFormReady?.("password", "13800138000", "secret"),
    true,
  );
  assert.equal(
    passwordValidation.isLoginFormReady?.("password", "13800138000", ""),
    false,
  );
  assert.equal(
    passwordValidation.isLoginFormReady?.("sms", "13800138000", "123456"),
    true,
  );
  assert.equal(
    passwordValidation.isLoginFormReady?.("sms", "13800138000", "12345"),
    false,
  );
  assert.equal(
    passwordValidation.isLoginFormReady?.("sms", "23800138000", "123456"),
    false,
  );
});

test("SMS code action reflects sending and countdown states", () => {
  assert.equal(passwordValidation.getSmsCodeActionLabel?.(true, 0), "发送中...");
  assert.equal(passwordValidation.getSmsCodeActionLabel?.(false, 60), "重新获取(60s)");
  assert.equal(passwordValidation.getSmsCodeActionLabel?.(false, 0), "获取验证码");
  assert.equal(
    passwordValidation.canSendSmsCode?.("13800138000", false, 0),
    true,
  );
  assert.equal(
    passwordValidation.canSendSmsCode?.("13800138000", true, 0),
    false,
  );
  assert.equal(
    passwordValidation.canSendSmsCode?.("13800138000", false, 12),
    false,
  );
  assert.equal(passwordValidation.canSendSmsCode?.("1380013", false, 0), false);
});
