import { Platform } from "react-native";
import { Pushy } from "react-native-update";

import updateConfig from "../../../update.json";

const androidAppKey =
  Platform.OS === "android" ? updateConfig.android?.appKey : undefined;

/** 仅 Android 使用的 Pushy 客户端；iOS / 其他平台为 null */
export const pushyClient =
  androidAppKey !== undefined && androidAppKey !== ""
    ? new Pushy({
        appKey: androidAppKey,
        // 关闭自动检查，等同意隐私后再手动 checkUpdate
        checkStrategy: null,
        // SDK 默认弹窗；网络错误不打扰用户
        updateStrategy: "alertUpdateAndIgnoreError",
        // 同意隐私前禁止原生冷启动检查发网络请求
        disableNativeCheck: true,
      })
    : null;
