# @esports/sso-sdk

React Native 统一认证客户端，按 Web SSO 的 OAuth2 接口和签名协议实现。HTTP 传输基于 Axios；如需自定义传输（如拦截器、mock、代理），可在 `SsoClientConfig` 中传入可选的 `adapter`（Axios `AxiosAdapter`）。

支持：

- 短信验证码
- 手机号验证码登录
- 账号密码登录
- refresh token
- 退出登录

```ts
const client = new SsoClient({
  baseUrl: "https://auth.yingbowl.com",
  clientAppId: "dianjing-android",
  clientSecret: runtimeSecret,
  os: "Android",
  sourceType: "dianjing-android",
});
```

`clientSecret` 由宿主注入，不写入包源码。阿里 H5 一键登录依赖浏览器 SDK，未在此包中实现；原生一键登录应通过平台原生 SDK Adapter 接入。

`clientSecret` 必须是 `Base64(client_id:原始 client_secret)`（含英文冒号），不是原始 Secret，也不是仅对 Secret 做 Base64。SDK 会直接发送 `AUTHORIZATION: basic <clientSecret>`，不会再次编码。移动端分别通过 `EXPO_PUBLIC_SSO_IOS_CLIENT_SECRET` 和 `EXPO_PUBLIC_SSO_ANDROID_CLIENT_SECRET` 注入，编码中的 `client_id` 必须与当前平台的 `clientAppId` 一致。

每次认证请求都会携带 `sourceType`：iOS 使用 `dianjing-ios`，Android 使用 `dianjing-android`。未显式传入时会根据 `os` 自动推断。

## 原生一键登录 Adapter

SSDK 已实现服务端协议，原生号码认证 SDK 只需要实现两个步骤：

```ts
const result = await client.quickLogin({
  checkLoginAvailable: (tokens) => nativeAliyun.checkAvailable(tokens),
  getLoginToken: (tokens) => nativeAliyun.authorize(tokens),
  cancel: () => nativeAliyun.cancel(),
});
```

`authorize` 返回 `{ spToken, phone? }` 后，SSDK 会调用 `grant_type=ali_h5_one_key` 换取业务 Token。Android/iOS 原生 Provider 需要在 Expo development build 中通过 Expo Module 或现有原生 SDK 接入，不能在 Expo Go 中运行。
