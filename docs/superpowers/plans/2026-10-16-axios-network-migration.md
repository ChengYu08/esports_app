# Axios Network Request Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app's JSON API and SSO HTTP clients from `fetch` to Axios while preserving their existing request, response, authentication, and logging behavior.

**Architecture:** Keep `apiClient(path, options)` as the app-facing compatibility boundary and implement it with a configured Axios instance, so feature API modules do not need a broad rewrite. Give `@esports/sso-sdk` its own Axios instance because it has a separate base URL, request-signature protocol, auth headers, and response rules. Keep the signed binary OSS `PUT` on its current Expo FileSystem plus `fetch` path; it is a specialized file-transfer path and is outside this JSON/SSO migration.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6, Axios, TanStack Query 5, npm workspaces.

**Spec:** Current conversation: migrate the mobile app's network request solution to Axios.

## Global Constraints

- This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.
- Read the Expo SDK 57 versioned documentation and current Axios React Native documentation before implementation: `https://docs.expo.dev/versions/v57.0.0/`.
- Install Expo-compatible packages with `npx expo install <package>`.
- Do not manually edit generated native projects; do not add a native networking module for this migration.
- Keep API paths, HTTP methods, JSON bodies, auth headers, backend signature inputs, response envelopes, and user-visible errors compatible unless a task below explicitly calls out cancellation behavior.
- Keep business tokens explicit per request; do not silently read credentials from global state in the shared transport.
- Keep the signed OSS upload path in `src/features/auth/oss-upload.ts` on its existing transport.
- Preserve all pre-existing unrelated working tree changes, including the current `app.json` and Android build artifact changes.
- Finish implementation with `npx expo lint` and `npx tsc --noEmit` as required by the project instructions.

## File Structure

- `src/core/network/axios-instance.ts`: shared Axios instance for the main business API base URL and JSON defaults.
- `src/core/network/api-client.ts`: compatibility adapter preserving `apiClient`, `RequestOptions`, `ApiError`, request logging, and auth-expiry handling while delegating transport to Axios.
- `src/features/**/api/*.ts` and `src/features/**/hooks/*.ts`: thread React Query cancellation signals through query functions and feature API functions.
- `packages/sso-sdk/src/client.ts`: Axios transport for SSO while retaining request signing, OAuth response handling, and diagnostic logging.
- `packages/sso-sdk/src/types.ts`, `src/index.ts`, `package.json`, and `README.md`: update the SSO transport injection type and document the Axios adapter seam.
- `package.json` and `package-lock.json`: install and lock Axios for the application and workspace package.
- `src/features/auth/oss-upload.ts`: intentionally unchanged; continues streaming the Expo FileSystem `File` through the existing signed OSS `PUT` flow.

---

### Task 1: Add Axios and establish workspace dependency ownership

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/sso-sdk/package.json`

**Interfaces:**
- Produces: Axios available to the app and explicitly declared by the workspace package that imports it.

- [ ] **Step 1: Check the SDK and Axios platform guidance**

Read the Expo 57 versioned docs and Axios React Native docs. Confirm the selected Axios release is JavaScript-only and works with the project's iOS and Android React Native runtimes. Do not add a native networking dependency.

- [ ] **Step 2: Install Axios through Expo's installer**

Run: `npx expo install axios`

Expected: the root `package.json` and `package-lock.json` declare the Expo-selected Axios version.

- [ ] **Step 3: Declare Axios for the SSO workspace package**

Copy the exact Axios version recorded in root `package.json` into `packages/sso-sdk/package.json` as a direct dependency, then run `npm install --package-lock-only` to synchronize the workspace lockfile. Keep root and workspace versions identical.

- [ ] **Step 4: Confirm dependency resolution**

Run: `npm ls axios`

Expected: the app and `@esports/sso-sdk` resolve the same installed Axios version without duplicate incompatible copies.

### Task 2: Replace the main API transport behind `apiClient`

**Files:**
- Create: `src/core/network/axios-instance.ts`
- Modify: `src/core/network/api-client.ts`

**Interfaces:**
- Consumes: `env.apiBaseUrl`, current `RequestOptions`, and `setAuthExpiredHandler` callers.
- Produces: the existing `apiClient<T>(path, options): Promise<T>` interface and `ApiError` contract, backed by Axios.

- [ ] **Step 1: Create the shared business API Axios instance**

Create one instance using `env.apiBaseUrl`, a 15,000 ms default timeout, and default `Accept: application/json` and `Content-Type: application/json` headers. Do not put a user token on instance defaults.

- [ ] **Step 2: Adapt current request options to Axios config**

In `apiClient`, map `body` to Axios `data`, preserve the provided HTTP method and custom headers, map `timeoutMs` to Axios `timeout`, pass the caller's `signal`, and add `{ token }` to request headers only when that call supplied a token. Return `response.data` so all current feature API modules keep their response shape.

- [ ] **Step 3: Preserve HTTP and business auth-expiry behavior**

Handle both Axios rejected HTTP responses and 2xx responses whose payload contains an auth-expiry code. Retain the current recognized codes (`401`, `UNAUTHORIZED`, `NOT_LOGIN`, `NOT_LOGGED_IN`), invoke the registered handler only when that request supplied a token, and continue excluding `/client/v1/user/logout`. Do not add automatic refresh or request replay.

- [ ] **Step 4: Preserve error and logging semantics**

Translate an Axios response error into `ApiError(message, status, code)` using `info`, then `message`, then the existing fallback. Translate a transport failure into the existing status `0` connectivity error. Keep request duration/status logging and avoid including request bodies or tokens in logs. Allow Axios cancellation errors through unchanged so React Query can treat them as cancellation rather than a network failure.

- [ ] **Step 5: Keep endpoint contracts unchanged**

Retain the existing `apiClient` export and `RequestOptions` usage. Do not convert feature endpoints to direct Axios calls; keep `apiClient` as the only ordinary business REST entry point.

### Task 3: Propagate query cancellation to Axios

**Files:**
- Modify: `src/features/home/hooks/use-home-data.ts`
- Modify: `src/features/home/api/home.api.ts`
- Modify: `src/features/ranking/hooks/use-ranking-data.ts`
- Modify: `src/features/ranking/api/ranking.api.ts`
- Modify: `src/features/ranking/api/ranking.contract.ts`
- Modify: `src/features/mine/hooks/use-profile-data.ts`
- Modify: `src/features/mine/api/profile.api.ts`
- Modify: `src/features/mine/hooks/use-user-follow.ts`
- Modify: `src/features/mine/api/user-follow.api.ts`
- Modify: `src/features/search/hooks/use-club-search.ts`
- Modify: `src/features/search/hooks/use-user-search.ts`
- Modify: `src/features/search/api/search.api.ts`
- Modify: `src/features/order/hooks/use-order-page.ts`
- Modify: `src/features/order/order.api.ts`
- Modify: `src/app/order/[id].tsx`

**Interfaces:**
- Consumes: TanStack Query's `AbortSignal` from each query function context.
- Produces: optional `signal?: AbortSignal` parameters on queried API functions, passed through `apiClient` to Axios. Existing non-query callers remain valid because the parameter is optional.

- [ ] **Step 1: Thread signals through home and ranking queries**

Change query functions to accept `({ signal })` and pass that signal through their API functions to `apiClient`. Preserve page parameters, filters, query keys, and enabled conditions.

- [ ] **Step 2: Thread signals through mine and search queries**

Apply the same optional-signal pattern to profile, follow-list, club-search, and user-search query functions. Do not change mutation payloads or cache keys.

- [ ] **Step 3: Thread signals through order queries**

Pass the query signal from `use-order-page.ts` and the order detail `useQuery` in `src/app/order/[id].tsx` through the order API functions. Keep user-triggered mutations unchanged.

- [ ] **Step 4: Confirm cancellation is not presented as a network error**

Verify the Axios cancellation branch from Task 2 remains intact and that query cancellation does not surface the generic connectivity message or trigger auth-expiry handling.

### Task 4: Migrate the SSO SDK transport to Axios

**Files:**
- Modify: `packages/sso-sdk/src/client.ts`
- Modify: `packages/sso-sdk/src/types.ts`
- Modify: `packages/sso-sdk/src/index.ts`
- Modify: `packages/sso-sdk/README.md`

**Interfaces:**
- Consumes: existing `SsoClientConfig`, `SsoRequestOptions`, `createSignature`, and login/reset callers.
- Produces: the same public SsoClient login, token, logout, and quick-login methods, using Axios internally. Expose an optional `AxiosAdapter` in `SsoClientConfig` as the transport injection seam for host apps and deterministic callers.

- [ ] **Step 1: Create an SSO-specific Axios instance**

Configure the instance with the normalized SSO `baseUrl` and `timeoutMs ?? 15_000`. Keep it separate from the business API instance so base URL and request defaults cannot leak between services.

- [ ] **Step 2: Preserve SSO request construction and signatures**

Continue adding `sourceType` before signing. For POST-like methods, send the signed data as JSON. For GET, preserve the existing `URLSearchParams` wire serialization and signed query values; do not rely on Axios's default parameter serializer unless it is explicitly configured to produce the same query string. Keep `PZ*`, `Skey`, `sign`, and `AUTHORIZATION` headers in their current order/override behavior.

- [ ] **Step 3: Preserve SSO response and error behavior**

Read response data from Axios, keep status/code request logging, continue requiring `access_token` from OAuth token endpoints, and retain `SUCCESS` checks plus `skipCodeCheck`. Convert HTTP and protocol failures to `SsoError` with the response message, status, and code. Network and timeout failures should still be logged without logging credentials or payloads.

- [ ] **Step 4: Replace fetch injection with the Axios adapter seam**

Remove the `fetch?: typeof globalThis.fetch` field from `SsoClientConfig` and add `adapter?: AxiosAdapter`. Export the adapter type through the package entry point if callers need to inject it. Keep `src/app/login.tsx` and `src/app/forgot-password.tsx` configuration behavior unchanged because they do not currently inject a fetcher.

- [ ] **Step 5: Update SSO package documentation**

Update the SSO README to state that the SDK uses Axios and accepts an optional Axios adapter for transport customization. Preserve the existing client secret, platform, source type, and native quick-login guidance.

### Task 5: Validate migration on both mobile platforms

**Files:**
- Review: `src/core/network/api-client.ts`
- Review: `packages/sso-sdk/src/client.ts`
- Review: `src/features/auth/oss-upload.ts`
- Review: all `src/features/**/api` callers listed above

**Interfaces:**
- Consumes: the migrated Axios clients and unchanged public API surfaces.
- Produces: verified iOS and Android behavior with only the documented signed OSS upload remaining on direct `fetch`.

- [ ] **Step 1: Check remaining direct fetch calls**

Run: `rtk rg -n '\bfetch\s*\(' src packages`

Expected: the app API and SSO client contain no direct `fetch` calls; `src/features/auth/oss-upload.ts` remains the documented direct binary upload path.

- [ ] **Step 2: Run project static checks**

Run: `npx expo lint`

Expected: no lint errors introduced by the Axios migration.

Run: `npx tsc --noEmit`

Expected: no TypeScript errors, including workspace SSO adapter types and optional query signals.

- [ ] **Step 3: Smoke-test Android and iOS request flows**

In development builds on both platforms, verify public GET, authenticated GET, JSON POST, SMS login, password login, quick login where the native provider is configured, password reset, profile refresh, one auth-expiry response, route-change query cancellation, and profile-image OSS upload. Confirm the OSS request still uses its signed `PUT` and returns the same public object URL.

- [ ] **Step 4: Review the final diff for scope and worktree safety**

Confirm the only remaining direct-fetch runtime path is the documented OSS upload, feature API response mappings are unchanged, and unrelated pre-existing changes (including `app.json` and Android build artifacts) remain untouched.
