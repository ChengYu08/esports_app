import { NativeModule, requireOptionalNativeModule } from "expo";

declare class ExpoAppToolkitModule extends NativeModule {
  /** Android 8+ 读取"安装未知应用"授权状态；低版本系统返回 true */
  canRequestPackageInstalls(): boolean;
  /** 流式计算本地文件 MD5，返回小写 32 位 hex；文件不存在时抛错 */
  md5File(uri: string): Promise<string>;
  /** 记录隐私政策已同意并触发融云/厂商推送 SDK 初始化；仅在用户同意后调用，进程内幂等 */
  markPrivacyConsentAccepted(): void;
  /**
   * 读取原生暂存的融云推送点击数据（AppDelegate/MainActivity 在通知点击时写入）。
   * iOS 返回 { targetId, conversationType } 对象；Android 返回 pushData JSON 字符串。
   * 无待处理数据时返回 null；读取成功后必须调 clearPendingPushClick 清除，避免重复跳转。
   */
  getPendingPushClick(): Promise<
    { targetId: string; conversationType: string } | string | null
  >;
  /** 清除原生暂存的推送点击数据 */
  clearPendingPushClick(): Promise<void>;
  /** 清除桌面 App 图标角标及融云已展示的推送通知 */
  clearAppIconBadge?(): void;
}

// Expo Go / 未重新 prebuild 的构建中不存在，保持 nullable 由调用方回退
export default requireOptionalNativeModule<ExpoAppToolkitModule>(
  "ExpoAppToolkit",
);
