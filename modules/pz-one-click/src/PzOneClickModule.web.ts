import { registerWebModule, NativeModule } from 'expo';

import { PzOneClickModuleEvents } from './PzOneClick.types';

// PzOneClickModule is not available on the web platform.
class PzOneClickModule extends NativeModule<PzOneClickModuleEvents> {}

export default registerWebModule(PzOneClickModule, 'PzOneClickModule');
