# @esports/auth

认证领域独立包，负责登录 UI、认证领域类型和会话状态。

## 边界

- 不依赖 Expo Router；宿主通过 `onBack`、`onSkip`、`onLogin` 和 `onSendCode` 注入导航及副作用。
- 不直接调用项目网络层；真实登录接口通过宿主 Adapter 注入。
- 一键登录通过 `onQuickLogin` 注入原生号码认证 Provider，认证包不绑定 Android/iOS SDK。
- 会话状态通过 `useAuthStore` 暴露，持久化策略由宿主在登录成功后接入。

## 使用

```tsx
import { LoginScreen } from "@esports/auth";

<LoginScreen
  onBack={router.back}
  onSkip={() => router.replace("/")}
  onLogin={loginWithCode}
/>
```
