import { NativeModule, requireOptionalNativeModule } from "expo";

declare class ExpoAppToolkitModule extends NativeModule {
  /** Android 8+ 读取"安装未知应用"授权状态；低版本系统返回 true */
  canRequestPackageInstalls(): boolean;
  /** 流式计算本地文件 MD5，返回小写 32 位 hex；文件不存在时抛错 */
  md5File(uri: string): Promise<string>;
}

// Expo Go / 未重新 prebuild 的构建中不存在，保持 nullable 由调用方回退
export default requireOptionalNativeModule<ExpoAppToolkitModule>(
  "ExpoAppToolkit",
);
