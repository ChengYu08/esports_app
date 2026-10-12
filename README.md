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

或者使用 EAS：

```
npx eas-cli build --profile development
```

准备发布apk

npx expo prebuild # 生成 android/ 原生目录
cd android
./gradlew assembleRelease # 出 APK
./gradlew bundleRelease # 出 AAB

用户协议
https://www.luanfengxuan.cn/vpi/pages/pzdj_privacy

服务协议
https://www.luanfengxuan.cn/vpi/pages/pzdj_user

1、注销登录

2、排行傍

3、网络体验问题

4、打包构建

5、切换到正式环境

6、登录使用标识
