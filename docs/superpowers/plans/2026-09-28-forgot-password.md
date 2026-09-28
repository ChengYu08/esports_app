# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete mobile password login and add a Web-compatible forgot-password flow with local password visibility controls, MD5 password submission, reset SMS, and return-to-login state restoration.

**Architecture:** Keep reusable React Native form components in `packages/auth`, SSO transport and password request construction in `packages/sso-sdk`, and Expo Router navigation plus alerts in `src/app`. Pure request-building and validation modules provide testable boundaries without adding a new test dependency.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router 57, TypeScript 6, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-28-forgot-password-design.md`

## Global Constraints

- Password login supports mainland China mobile numbers only and always displays `+86`.
- Do not add third-party dependencies.
- Password login and password reset must MD5 the password exactly once before sending it.
- Reset SMS uses `smsTemplate: "MOD"`.
- Passwords are 8–16 characters, contain no whitespace, and include at least three of special, uppercase, lowercase, and numeric character classes.
- Route components stay in `src/app`; reusable components, validation, and API logic stay outside it.
- Do not add or edit generated `ios/` or `android/` directories.
- Do not draw a fake status bar or Home Indicator on the forgot-password screen.
- Preserve unrelated staged and unstaged user changes.

---

### Task 1: SSO Password Request Contracts

**Files:**
- Create: `packages/sso-sdk/src/password-requests.ts`
- Create: `packages/sso-sdk/password-requests.test.mjs`
- Modify: `packages/sso-sdk/src/client.ts:1-53`
- Modify: `packages/sso-sdk/src/index.ts:1-6`
- Modify: `packages/auth/src/sso-adapter.ts:1-12`
- Modify: `packages/auth/sso-adapter.test.mjs`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `createPasswordLoginRequest(username: string, password: string): PasswordRequest`
- Produces: `createForgetPasswordRequest(phone: string, smsCode: string, password: string): PasswordRequest`
- Produces: `SsoClient.forgetPassword(phone: string, smsCode: string, password: string): Promise<unknown>`
- Produces: adapter methods `sendResetCode(phone)` and `forgetPassword(payload)`

- [ ] **Step 1: Write failing request-contract tests**

Add `packages/sso-sdk/password-requests.test.mjs`:

```js
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
```

Before implementing, independently verify the literal MD5 value with:

```bash
printf 'Abc123!@' | md5
```

- [ ] **Step 2: Run the request tests and verify RED**

Run:

```bash
node --no-warnings --test packages/sso-sdk/password-requests.test.mjs
```

Expected: FAIL because `password-requests.ts` does not exist.

- [ ] **Step 3: Implement pure request builders**

Add `allowImportingTsExtensions: true` to `compilerOptions` in `tsconfig.json`, then create `password-requests.ts`:

```ts
import { md5 } from "./md5.ts";

export type PasswordRequest = {
  path: string;
  data: Record<string, string>;
};

export function createPasswordLoginRequest(
  username: string,
  password: string,
): PasswordRequest {
  return {
    path: "/api/auth/oauth2/token",
    data: {
      grant_type: "password",
      username,
      password: md5(password),
      scope: "openid",
    },
  };
}

export function createForgetPasswordRequest(
  phone: string,
  smsCode: string,
  password: string,
): PasswordRequest {
  return {
    path: "/api/auth/public/common/forget-password",
    data: { phone, smsCode, password: md5(password) },
  };
}
```

- [ ] **Step 4: Wire builders into `SsoClient`**

Import both builders in `client.ts`. Replace `passwordLogin` with:

```ts
passwordLogin(username: string, password: string) {
  const request = createPasswordLoginRequest(username, password);
  return this.request<SsoToken>(request.path, { data: request.data });
}
```

Add:

```ts
forgetPassword(phone: string, smsCode: string, password: string) {
  const request = createForgetPasswordRequest(phone, smsCode, password);
  return this.request(request.path, { data: request.data });
}
```

Export the request builders and `PasswordRequest` type from `packages/sso-sdk/src/index.ts`.

- [ ] **Step 5: Add adapter contracts and a failing adapter test**

Extend `packages/auth/sso-adapter.test.mjs` with a fake client that records `getSmsCode` and `forgetPassword` calls, then assert:

```js
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
  { phone: "13800138000", smsCode: "123456", password: "Abc123!@" },
]);
```

Run the adapter test and confirm it fails because both methods are missing.

- [ ] **Step 6: Implement adapter methods**

Define and export:

```ts
export type ForgotPasswordPayload = {
  phone: string;
  code: string;
  password: string;
};
```

Add to the returned adapter:

```ts
sendResetCode: async (phone: string) => {
  await client.getSmsCode(phone, "MOD");
},
forgetPassword: (payload: ForgotPasswordPayload) =>
  client.forgetPassword(payload.phone, payload.code, payload.password),
```

- [ ] **Step 7: Verify Task 1 GREEN**

Run:

```bash
node --no-warnings --test packages/sso-sdk/password-requests.test.mjs packages/auth/sso-adapter.test.mjs
npx tsc --noEmit
```

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/sso-sdk/src/password-requests.ts packages/sso-sdk/password-requests.test.mjs packages/sso-sdk/src/client.ts packages/sso-sdk/src/index.ts packages/auth/src/sso-adapter.ts packages/auth/sso-adapter.test.mjs tsconfig.json
git commit -m "feat(auth): add forgot password SSO contracts"
```

---

### Task 2: Shared Forgot-Password Validation

**Files:**
- Create: `packages/auth/src/password-validation.ts`
- Create: `packages/auth/password-validation.test.mjs`
- Modify: `packages/auth/src/index.ts`

**Interfaces:**
- Produces: `sanitizePhone(value: string): string`
- Produces: `sanitizeCode(value: string): string`
- Produces: `validatePhone(phone: string): string | null`
- Produces: `validatePassword(password: string): string | null`
- Produces: `validatePasswordConfirmation(password: string, confirmation: string): string | null`

- [ ] **Step 1: Write failing validation tests**

Create a table-driven Node test covering these literals:

```js
assert.equal(sanitizePhone("13a800-138000"), "13800138000");
assert.equal(sanitizeCode("12a34567"), "123456");
assert.equal(validatePhone(""), "请输入手机号");
assert.equal(validatePhone("12800138000"), "请输入正确的手机号");
assert.equal(validatePhone("13800138000"), null);
assert.equal(validatePassword("Ab1!"), "密码长度为8-16位");
assert.equal(validatePassword("Abc 123!"), "密码不允许有空格");
assert.equal(validatePassword("abcdefgh"), "密码需包含特殊字符(如:%、&、#等)、大写字母、小写字母、数字中的三种或以上");
assert.equal(validatePassword("Abc123!@"), null);
assert.equal(validatePasswordConfirmation("Abc123!@", "Abc123!#"), "两次输入的密码不一致");
```

- [ ] **Step 2: Run the validation test and verify RED**

Run `node --no-warnings --test packages/auth/password-validation.test.mjs`.

Expected: FAIL because the validation module does not exist.

- [ ] **Step 3: Implement minimal validation**

Implement digit sanitization with `.replace(/\D/g, "").slice(...)`, phone validation with `/^1\d{10}$/`, and the exact password class rules from the spec. Keep the module free of React Native dependencies so Node can execute it directly.

- [ ] **Step 4: Export validation APIs**

Export all five functions from `packages/auth/src/index.ts` so screens and external consumers share one rule set.

- [ ] **Step 5: Verify Task 2 GREEN**

Run:

```bash
node --no-warnings --test packages/auth/password-validation.test.mjs
npx tsc --noEmit
```

Expected: all assertions pass and TypeScript reports no errors.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/auth/src/password-validation.ts packages/auth/password-validation.test.mjs packages/auth/src/index.ts
git commit -m "feat(auth): add password reset validation"
```

---

### Task 3: Password Login UI and Route Restoration

**Files:**
- Create: `packages/auth/assets/eye-open.svg`
- Create: `packages/auth/assets/eye-closed.svg`
- Modify: `packages/auth/src/LoginScreen.tsx:1-270`
- Modify: `src/app/login.tsx:1-62`

**Interfaces:**
- Consumes: `sanitizePhone`, `validatePhone`, existing `PasswordLoginPayload`
- Produces: `LoginScreenProps.initialMode?: "sms" | "password"`
- Produces: `LoginScreenProps.initialPhone?: string`
- Produces: `LoginScreenProps.onForgotPassword?: (phone: string) => void`
- Consumes route parameters `{ mode?: string; phone?: string }`

- [ ] **Step 1: Add local eye assets**

Create two 24×24 SVGs with `viewBox="0 0 24 24"`, no background, `currentColor`-independent gray strokes (`#999`), and distinct visible/hidden states. Keep the entire icon in one SVG per state so Expo performs one image render per button.

- [ ] **Step 2: Make login screen initialization explicit**

Add optional `initialMode` and `initialPhone` props. Initialize state with:

```ts
const [mode, setMode] = useState<"sms" | "password">(initialMode ?? "sms");
const [phone, setPhone] = useState(() => sanitizePhone(initialPhone ?? ""));
const [passwordVisible, setPasswordVisible] = useState(false);
```

The phone field must always render the `+86` prefix in both SMS and password modes, use `phone-pad`, set `maxLength={11}`, and sanitize input.

- [ ] **Step 3: Add password controls**

In password mode, render after the password input:

```tsx
<Pressable
  accessibilityLabel={passwordVisible ? "隐藏密码" : "显示密码"}
  accessibilityRole="button"
  hitSlop={8}
  onPress={() => setPasswordVisible((visible) => !visible)}
>
  <Image source={passwordVisible ? eyeOpenIcon : eyeClosedIcon} ... />
</Pressable>
<Pressable
  accessibilityLabel="忘记密码"
  accessibilityRole="button"
  onPress={() => onForgotPassword?.(phone)}
>
  <Text>忘记密码</Text>
</Pressable>
```

Set `secureTextEntry={!passwordVisible}` and `maxLength={16}`. Preserve the existing SMS code button only in SMS mode.

- [ ] **Step 4: Restore route state and wire forgot navigation**

In `src/app/login.tsx`, use:

```ts
const params = useLocalSearchParams<{ mode?: string; phone?: string }>();
const initialMode = params.mode === "password" ? "password" : "sms";
const initialPhone = typeof params.phone === "string" ? params.phone : "";
```

Pass both props and navigate with:

```ts
onForgotPassword={(phone) =>
  router.push({ pathname: "/forgot-password", params: { phone } })
}
```

Wrap password login in the same error handling shape as quick login so rejected requests do not become unhandled promises.

- [ ] **Step 5: Verify Task 3**

Run:

```bash
npx expo lint
npx tsc --noEmit
```

Then manually confirm both modes retain `+86`, the icon toggles password visibility, and the forgot-password tap produces the expected route and phone parameter.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/auth/assets/eye-open.svg packages/auth/assets/eye-closed.svg packages/auth/src/LoginScreen.tsx src/app/login.tsx
git commit -m "feat(auth): complete password login controls"
```

---

### Task 4: Forgot-Password Screen and Expo Route

**Files:**
- Create: `packages/auth/src/ForgotPasswordScreen.tsx`
- Modify: `packages/auth/src/index.ts`
- Create: `src/app/forgot-password.tsx`

**Interfaces:**
- Consumes: validation APIs from Task 2
- Consumes: `ForgotPasswordPayload`, `sendResetCode`, and `forgetPassword` from Task 1
- Produces: `ForgotPasswordScreenProps` with `initialPhone`, `onBack`, `onSendCode`, and `onSubmit`

- [ ] **Step 1: Define the reusable screen contract**

Use:

```ts
export type ForgotPasswordScreenProps = {
  initialPhone?: string;
  onBack: () => void;
  onSendCode: (phone: string) => void | Promise<void>;
  onSubmit: (payload: ForgotPasswordPayload) => void | Promise<void>;
};
```

The component owns `phone`, `code`, `password`, `confirmation`, `passwordVisible`, `confirmationVisible`, `countdown`, `sending`, `submitting`, and `validationMessage` state.

- [ ] **Step 2: Implement reset-code behavior**

Before calling `onSendCode`, call `validatePhone`. On success set countdown to 60. If the callback rejects after the route has displayed its API error, catch it locally so React Native does not report an unhandled promise. Use an effect that decrements once per second and returns `clearInterval`, ensuring no update survives unmount. Keep the send control disabled while `sending` or `countdown > 0`.

- [ ] **Step 3: Implement submit behavior**

Validate in this order: phone, non-empty code, password, confirmation. Call:

```ts
await onSubmit({ phone, code, password });
```

Use `try/finally` to restore `submitting`. Do not navigate or show an API alert inside the reusable component.

- [ ] **Step 4: Build the mobile-first layout**

Use `SafeAreaView`, `KeyboardAvoidingView`, and `ScrollView` so small devices and open keyboards remain usable. Render a real back control, title “忘记密码”, four gray input rows, two independent local eye icons, password rule copy, inline validation copy, and a red save button. Do not hide the system status bar and do not render a fake Home Indicator.

- [ ] **Step 5: Export the screen and types**

Export `ForgotPasswordScreen`, `ForgotPasswordScreenProps`, and `ForgotPasswordPayload` from `packages/auth/src/index.ts` without exporting Expo Router concerns.

- [ ] **Step 6: Add the Expo Router screen**

Create `src/app/forgot-password.tsx`. Read the optional phone param with `useLocalSearchParams`, construct `SsoClient` with the same `env`, platform, and `sourceType` values as the login route, and create the auth adapter.

Use this error helper:

```ts
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
```

Pass handlers:

```tsx
onBack={() => router.back()}
onSendCode={async (phone) => {
  if (!adapter) throw new Error("请先配置 SSO client secret。");
  try {
    await adapter.sendResetCode(phone);
  } catch (error) {
    Alert.alert("验证码发送失败", getErrorMessage(error, "发送验证码失败"));
    throw error;
  }
}}
onSubmit={async (payload) => {
  if (!adapter) {
    Alert.alert("密码重置失败", "请先配置 SSO client secret。");
    return;
  }
  try {
    await adapter.forgetPassword(payload);
    Alert.alert("密码重置成功", "请使用新密码登录。", [
      {
        text: "去登录",
        onPress: () => router.replace({
          pathname: "/login",
          params: { mode: "password", phone: payload.phone },
        }),
      },
    ]);
  } catch (error) {
    Alert.alert("密码重置失败", getErrorMessage(error, "密码重置失败"));
    throw error;
  }
}}
```

- [ ] **Step 7: Verify Task 4**

Run all tests and static checks:

```bash
node --no-warnings --test packages/auth/*.test.mjs packages/sso-sdk/*.test.mjs
npx expo lint
npx tsc --noEmit
git diff --check
```

Expected: zero test failures, zero lint/type errors, and no whitespace errors.

- [ ] **Step 8: Perform manual acceptance**

Verify on a mobile runtime:

1. Password mode always displays `+86` and accepts at most 11 digits.
2. Both password visibility controls toggle independently.
3. “忘记密码” carries the current phone number to the reset screen.
4. Reset SMS sends with `MOD` and starts a 60-second countdown only after success.
5. Invalid passwords show the exact local rule message without sending a request.
6. Successful reset returns to password login with the phone filled and password empty.
7. Back navigation does not reopen a completed reset screen.

- [ ] **Step 9: Commit Task 4**

```bash
git add packages/auth/src/ForgotPasswordScreen.tsx packages/auth/src/index.ts src/app/forgot-password.tsx
git commit -m "feat(auth): add forgot password flow"
```

---

### Task 5: Final Regression Verification

**Files:**
- Verify only; modify a task-owned file only if a regression is found.

**Interfaces:**
- Consumes all prior task outputs.
- Produces a verified end-to-end authentication change ready for user review.

- [ ] **Step 1: Run the complete automated gate**

```bash
node --no-warnings --test packages/auth/*.test.mjs packages/sso-sdk/*.test.mjs
npx expo lint
npx tsc --noEmit
git diff --check
```

- [ ] **Step 2: Review the implementation against the spec**

Check every requirement in `docs/superpowers/specs/2026-09-28-forgot-password-design.md`, including local assets, `+86`, MD5 once, `MOD`, password rules, cleanup, loading guards, route replacement, and phone restoration.

- [ ] **Step 3: Inspect final repository state**

Run `git status --short` and `git diff --stat`. Confirm no unrelated user changes were staged, reverted, or committed by implementation work.
