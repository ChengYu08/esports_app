import StarRechargeEntry from "@/features/mine/screens/StarRechargeEntry";

/** 平台拆分见 StarRechargeEntry.ios.tsx / StarRechargeEntry.android.tsx:
 *  iOS 只打包苹果内购充值页,Android 支付页(支付宝/微信)不进 iOS bundle。 */
export default function StarRechargeRoute() {
  return <StarRechargeEntry />;
}
