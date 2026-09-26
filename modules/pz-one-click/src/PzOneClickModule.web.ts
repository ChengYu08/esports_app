import { registerWebModule, NativeModule } from 'expo';

import { PzOneClickModuleEvents } from './PzOneClick.types';

// PzOneClickModule is not available on the web platform.
class PzOneClickModule extends NativeModule<PzOneClickModuleEvents> {
  checkLoginAvailableAsync(): Promise<boolean> { return Promise.resolve(false); }
  authorizeAsync(): Promise<{ spToken: string; phone?: string }> {
    return Promise.reject(new Error('原生一键登录仅支持 Android/iOS development build'));
  }
  cancelAsync(): Promise<void> { return Promise.resolve(); }
}

export default registerWebModule(PzOneClickModule, 'PzOneClickModule');
