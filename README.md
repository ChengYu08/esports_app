# 盼之电竞

基于 Expo 与 React Native 构建的移动端应用。

## 开发

```bash
npm install
npx expo start
```

路由页面位于 `src/app/`，业务代码位于 `src/` 的其他目录。

```
npx expo run:ios
npx expo run:android
```

准备发布 apk：`npm run build:apk`（仅 ARM64）；同时打 ARM64 + 双架构包：`npm run build:apk:all`。详见 `scripts/BUILD_APK.md`。

https://djpc.jlgkj.top/privacy.html

1、注销登录 ✅

2、排行傍 ✅

3、网络体验问题 ✅ 切换到正式换成即可 测试环境限制了局域网访问

4、打包构建

5、切换到正式环境

6、登录使用标识 ✅

7、上架截图 上架描述、隐私协议、用户协议、域名映射
