import { Platform } from "react-native";

import StarRechargeAndroidScreen from "@/features/mine/screens/StarRechargeAndroidScreen";
import StarRechargeScreen from "@/features/mine/screens/StarRechargeScreen";

/** 仅供 tsc 解析与 web 等平台兜底;iOS/Android 实际加载
 *  StarRechargeEntry.ios.tsx / StarRechargeEntry.android.tsx,
 *  本文件不会进入 iOS / Android 的 bundle。 */
export default function StarRechargeEntry() {
  if (Platform.OS === "android") {
    return <StarRechargeAndroidScreen />;
  }
  return <StarRechargeScreen />;
}
