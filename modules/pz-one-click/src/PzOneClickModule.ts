import { NativeModule, requireOptionalNativeModule } from 'expo';

import { PzOneClickModuleEvents, QuickLoginAuthToken, QuickLoginResult } from './PzOneClick.types';

declare class PzOneClickModule extends NativeModule<PzOneClickModuleEvents> {
  checkLoginAvailableAsync(tokens: QuickLoginAuthToken): Promise<boolean>;
  authorizeAsync(tokens: QuickLoginAuthToken): Promise<QuickLoginResult>;
  cancelAsync(): Promise<void>;
}

// Expo Go does not bundle this app-specific native module. Keep the value
// nullable so importing the login route does not crash before the screen can
// explain that a development build is required.
export default requireOptionalNativeModule<PzOneClickModule>('PzOneClick');
