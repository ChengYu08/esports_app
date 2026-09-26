import { NativeModule, requireNativeModule } from 'expo';

import { PzOneClickModuleEvents } from './PzOneClick.types';

declare class PzOneClickModule extends NativeModule<PzOneClickModuleEvents> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<PzOneClickModule>('PzOneClick');
