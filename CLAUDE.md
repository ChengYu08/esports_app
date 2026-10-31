# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

盼之电竞 (Esports App) — Expo/React Native mobile application with integrated IM (RongCloud), authentication via workspace SSO SDK, and feature-based architecture.

This is the mobile client in a multi-repo workspace:

- PC: `/Users/yucheng/Desktop/盼之电竞/pzdj-pc`
- Admin: `/Users/yucheng/Desktop/盼之电竞/pzdj-admin`
- Mobile: `/Users/yucheng/Desktop/盼之电竞/esports_app` (this repo)
- Backend: `/Users/yucheng/Desktop/盼之电竞/pzdj-service`
- Task Service: `/Users/yucheng/Desktop/盼之电竞/pzdj-task-service`

## Commands

```bash
# Development
npm install                    # Install dependencies (never use yarn/pnpm/bun add)
npx expo install <package>     # ALWAYS use this instead of npm add — resolves SDK-compatible versions
npx expo start                 # Start dev server
npx expo run:ios               # Run on iOS simulator/device
npx expo run:android           # Run on Android emulator/device
npx expo run:android --device  # Run on physical Android device

# Quality checks
npx expo lint                  # Lint
npx tsc --noEmit               # Type check (REQUIRED before finishing any task)

# Diagnostics
npx expo-doctor                # Diagnose dependency/config issues
npx expo install --fix         # Fix incompatible package versions

# Building
npx expo prebuild              # Generate native directories (android/, ios/)
cd android && ./gradlew assembleRelease  # Build APK
cd android && ./gradlew bundleRelease    # Build AAB

# EAS (cloud builds)
npx eas-cli build --profile development
npx eas-cli submit
npx eas-cli update
```

**Always run `npx expo lint` and `npx tsc --noEmit` before declaring a task complete.**

## Architecture

### Directory Structure

```
src/
├── app/                    # Expo Router routes (file-based routing)
│   ├── (tabs)/            # Tab navigator screens
│   ├── chat/              # Chat-related routes
│   ├── club/              # Club-related routes
│   ├── order/             # Order-related routes
│   ├── _layout.tsx        # Root layout with providers
│   └── *.tsx              # Individual screens (login, profile, etc.)
├── features/              # Feature modules (domain logic + UI)
│   ├── auth/              # Authentication (LoginScreen, ForgotPasswordScreen)
│   ├── home/              # Home feed
│   ├── match/             # Match/game features
│   ├── message/           # IM integration (RongCloud wrapper, ChatScreen)
│   ├── mine/              # User profile and settings
│   ├── order/             # Order management
│   ├── privacy/           # Privacy-related features
│   └── search/            # Search functionality
├── shared/                # Shared UI components and utilities
│   ├── audio/             # Audio player components
│   ├── navigation/        # Navigation utilities (tab access)
│   ├── theme/             # Design tokens, typography
│   └── ui/                # Reusable UI components
├── core/                  # Infrastructure layer
│   ├── config/            # Environment config (env.ts)
│   ├── logging/           # Logger
│   ├── network/           # API client (apiClient with token header)
│   ├── query/             # React Query client
│   └── storage/           # Async storage wrapper
├── state/                 # (Currently empty — state in feature modules)
└── types/                 # Shared TypeScript types

packages/                  # Workspace packages
├── auth/                  # @esports/auth — Zustand auth store, SSO adapter
└── sso-sdk/               # @esports/sso-sdk — SSO client, MD5 signature
```

### Key Patterns

**Routing**: Expo Router (file-based). Routes live in `src/app/`, non-route code lives outside `src/app/`. Use `Link`, `router`, `useLocalSearchParams` from `expo-router`.

**State Management**:

- **Global auth**: Zustand store in `packages/auth/src/auth-store.ts` (`useAuthStore`)
- **Server state**: React Query (`@tanstack/react-query`) via `src/core/query/query-client.ts`
- **Local state**: React hooks (`useState`, `useReducer`)

**API Calls**: Use `apiClient` from `src/core/network/api-client.ts`. Automatically adds:

- Base URL from `env.apiBaseUrl`
- `token` header for authentication (pass as `{ token: accessToken }`)
- 15s timeout (configurable via `timeoutMs`)
- JSON content-type
- Error handling with `ApiError`

**IM Integration**: RongCloud via `@rongcloud/react-native-im-wrapper`. Wrapper in `src/features/message/rongcloud-im.ts`:

- `connectRongCloud(accessToken)` — Connects to IM, fetches IM token from backend
- `getRongConversations()` — Fetches conversation list
- `subscribeRongMessages(onMessage)` — Real-time message listener
- `sendRongText(targetId, text)` — Send text message
- `sendRongImage(targetId, path)` — Send image
- `disconnectRongCloud()` — Cleanup on logout
- Native module availability check: `isRongCloudAvailable()` (false on Expo Go, true on dev builds)

**Path Aliases** (tsconfig.json):

- `@/*` → `src/*`
- `@/assets/*` → `assets/*`
- `@esports/auth` → `packages/auth/src/index.ts`
- `@esports/sso-sdk` → `packages/sso-sdk/src/index.ts`

## Expo SDK Version

Current: **Expo SDK 57** (see `package.json`).

**CRITICAL**: Expo APIs change every SDK release. Before writing any Expo/React Native code:

1. Fetch versioned docs: `https://docs.expo.dev/versions/v57.0.0/`
2. For general guidance: `https://docs.expo.dev/llms.txt`
3. Never trust training data — always verify against current docs.

## Native Modules & Development Builds

- **Expo Go**: Only includes bundled Expo modules. Does NOT support RongCloud IM or custom native code.
- **Development build required** after adding:
  - RongCloud IM (`@rongcloud/react-native-im-wrapper`)
  - Any library with native code not in Expo Go

To create a dev build:

```bash
npx expo run:ios        # Local (requires Xcode)
npx expo run:android    # Local (requires Android Studio)
npx eas-cli build --profile development  # Cloud build via EAS
```

## Configuration

**app.json**:

- Package ID: `com.esportsapp.apps`
- Scheme: `esportsapp`
- Custom plugin: `./plugins/withNodeCommandUtf8` (fixes Gradle encoding on Windows)
- Permissions: Audio recording (for voice messages)
- Experiments: `typedRoutes`, `reactCompiler`

**No native directories by default**: `ios/` and `android/` are generated via Continuous Native Generation. Never edit them manually — configure via `app.json` and config plugins.

## 开发规范

**作为专业的 React Native 移动端工程师，遵循以下原则**:

- 组件化: 按功能拆分，提高可维护性
- 性能优化: 使用 `React.memo`、`useMemo`、`useCallback` 避免不必要的重渲染
- 跨平台兼容: 优先使用 Expo 模块，避免平台特定代码

**还原 Figma 设计**:

- 自动切图: 分析页面功能，识别可变区域，切图尽量大
- 去除状态栏: Figma 顶部手机状态栏在真实代码中不需要（真机自带）
- 优先检查 `package.json` 已有的库，避免重复引入

**代码质量**:

- 默认不写注释 — 只有非显而易见的逻辑才需要注释
- 不过度设计 — 三行相似代码优于过早抽象
- 不添加无法发生的错误处理 — 只在系统边界（用户输入、外部API）校验

## Testing

No test framework configured yet. If adding tests:

- Install a test runner (Jest, Vitest, or React Native Testing Library)
- Add test scripts to `package.json`
- Follow Expo testing best practices: https://docs.expo.dev/develop/unit-testing/

## Environment Variables

Managed in `src/core/config/env.ts`:

- `apiBaseUrl` — Backend API base URL
- `rongCloudAppKey` — RongCloud app key (for IM)

## Dependencies

Key libraries already installed:

- **UI**: `expo-image`, `expo-linear-gradient`, `expo-symbols`, `@expo/ui`, `rn-emoji-keyboard`
- **Navigation**: `expo-router`, `react-native-screens`, `react-native-safe-area-context`
- **State**: `zustand`, `@tanstack/react-query`
- **IM**: `@rongcloud/react-native-im-wrapper`
- **Storage**: `@react-native-async-storage/async-storage`, `expo-secure-store`
- **Media**: `expo-media-library`(相册选图/保存), `expo-audio`, `expo-file-system`
- **Animation**: `react-native-reanimated`, `react-native-gesture-handler`
- **Utils**: `zod`, `crypto-js`, `react-native-root-toast`

Before adding a new dependency, check if an Expo module or existing library can solve the problem.

## Common Issues

**RongCloud not working**: Ensure you're using a development build, not Expo Go. Check `isRongCloudAvailable()` returns true.

**Type errors after adding Expo module**: Run `npx expo install --fix` to resolve version mismatches.

**Android build fails**: Check `./plugins/withNodeCommandUtf8.js` is applied (fixes UTF-8 encoding on Windows).

**Navigation not working**: Routes must be in `src/app/`. Use `expo-router` APIs, not `react-navigation` directly.
