import { Platform } from "react-native";
import { Pushy } from "react-native-update";

import updateConfig from "../../../update.json";

const androidAppKey =
  Platform.OS === "android" ? updateConfig.android?.appKey : undefined;

/** 仅 Android release 包使用；dev 构建禁用，避免本地跑的包被 Pushy 后台的 ppk 覆盖 JS bundle */
export const pushyClient =
  Platform.OS === "android" &&
  !__DEV__ &&
  androidAppKey !== undefined &&
  androidAppKey !== ""
    ? new Pushy({
        appKey: androidAppKey,
        // 关闭自动检查，等同意隐私后再手动 checkUpdate
        checkStrategy: null,
        // 静默下载，稍后切换；远端配置可覆盖
        updateStrategy: "silentAndLater",
        // 同意隐私前禁止原生冷启动检查发网络请求
        disableNativeCheck: true,
      })
    : null;
