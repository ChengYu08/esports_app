import { Platform } from "react-native";

import StarRechargeAndroidScreen from "@/features/mine/screens/StarRechargeAndroidScreen";
import StarRechargeScreen from "@/features/mine/screens/StarRechargeScreen";

/** Android 走专用充值页；iOS 暂留旧页，由他人替换为 StarRechargeIosScreen。 */
export default function StarRechargeRoute() {
  if (Platform.OS === "android") {
    return <StarRechargeAndroidScreen />;
  }
  return <StarRechargeScreen />;
}
