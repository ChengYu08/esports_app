import { registerWebModule, NativeModule } from 'expo';

import { AliPayResult } from './AlipayPayment.Types';

class AlipayPaymentModule extends NativeModule<Record<string, never>> {
  payAsync(): Promise<AliPayResult> {
    return Promise.reject(new Error('当前环境不支持支付宝支付'));
  }
  registerAppAsync(): Promise<void> {
    return Promise.reject(new Error('当前环境不支持支付宝支付'));
  }
}

export default registerWebModule(AlipayPaymentModule, 'AlipayPaymentModule');
