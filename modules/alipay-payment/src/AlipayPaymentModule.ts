import { NativeModule, requireOptionalNativeModule } from 'expo';

import { AliPayResult } from './AlipayPayment.Types';

declare class AlipayPaymentModule extends NativeModule<Record<string, never>> {
  payAsync(orderStr: string, sandbox: boolean): Promise<AliPayResult>;
  registerAppAsync(appId: string): Promise<void>;
}

// Expo Go does not bundle this app-specific native module. Keep the value
// nullable so importing the recharge screen does not crash before it can
// explain that a development build is required.
export default requireOptionalNativeModule<AlipayPaymentModule>('AlipayPayment');
