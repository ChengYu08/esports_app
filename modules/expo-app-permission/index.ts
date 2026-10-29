import { NativeModule, requireOptionalNativeModule } from "expo";

declare class ExpoAppPermissionModule extends NativeModule {
  /** Android 8+ 读取"安装未知应用"授权状态；低版本系统返回 true */
  canRequestPackageInstalls(): boolean;
}

// Expo Go / 未重新 prebuild 的构建中不存在，保持 nullable 由调用方回退
export default requireOptionalNativeModule<ExpoAppPermissionModule>(
  "ExpoAppPermission",
);
