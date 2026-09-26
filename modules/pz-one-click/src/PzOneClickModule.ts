import { NativeModule, requireNativeModule } from 'expo';

import { PzOneClickModuleEvents, QuickLoginAuthToken, QuickLoginResult } from './PzOneClick.types';

declare class PzOneClickModule extends NativeModule<PzOneClickModuleEvents> {
  checkLoginAvailableAsync(tokens: QuickLoginAuthToken): Promise<boolean>;
  authorizeAsync(tokens: QuickLoginAuthToken): Promise<QuickLoginResult>;
  cancelAsync(): Promise<void>;
}

export default requireNativeModule<PzOneClickModule>('PzOneClick');
