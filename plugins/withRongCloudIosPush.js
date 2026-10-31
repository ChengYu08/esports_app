const {
  createRunOncePlugin,
  withInfoPlist,
  withAppDelegate,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-ios-push';

// Request push authorization and register for remote notifications on app launch.
const APP_DELEGATE_SNIPPET = `
    // RongCloud offline push — request authorization and register for remote notifications
    let notificationCenter = UNUserNotificationCenter.current()
    notificationCenter.delegate = self
    notificationCenter.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
      if granted {
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      }
    }
`;

// Directly set deviceToken to RongCloud in native layer (must happen before JS connect()).
// We use a static flag to ensure it's only set once per app lifecycle.
const DEVICE_TOKEN_HANDLER = `
  // RongCloud offline push — forward APNs deviceToken directly to RongCloud SDK
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    RongCloudPushHandler.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
  }
`;

// Handler class that imports RongIMWrapper and sets deviceToken.
const HANDLER_CLASS = `
import RongIMWrapper

final class RongCloudPushHandler {
  static let shared = RongCloudPushHandler()
  private var didSetToken = false

  func didRegisterForRemoteNotifications(deviceToken: Data) {
    guard !didSetToken else { return }
    didSetToken = true
    RCIMIWEngine.setDeviceToken(deviceToken)
  }
}
`;

function withRongCloudIosPush(config) {
  // 1. Add remote-notification to UIBackgroundModes
  config = withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes || [];
    if (!modes.includes('remote-notification')) {
      mod.modResults.UIBackgroundModes = [...modes, 'remote-notification'];
    }
    return mod;
  });

  // 2. Inject push registration into AppDelegate.didFinishLaunchingWithOptions
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error(`${TAG} requires Swift AppDelegate.`);
    }
    if (mod.modResults.contents.includes('RongCloudPushHandler')) return mod;

    // Insert authorization request after factory.startReactNative(...) call
    mod.modResults.contents = mod.modResults.contents.replace(
      /(factory\.startReactNative\([\s\S]*?\n\s*\)\n)/,
      `$1\n${APP_DELEGATE_SNIPPET}`,
    );

    // Insert deviceToken handler at the end of AppDelegate class body
    // (AppDelegate class ends right before "class ReactNativeDelegate")
    const classBoundary = mod.modResults.contents.indexOf('class ReactNativeDelegate');
    if (classBoundary !== -1) {
      const beforeBoundary = mod.modResults.contents.slice(0, classBoundary);
      const lastClose = beforeBoundary.lastIndexOf('}');
      if (lastClose !== -1) {
        mod.modResults.contents =
          beforeBoundary.slice(0, lastClose) +
          DEVICE_TOKEN_HANDLER +
          beforeBoundary.slice(lastClose) +
          mod.modResults.contents.slice(classBoundary);
      }
    }

    // Append the handler class at the end of the file
    mod.modResults.contents += HANDLER_CLASS;

    return mod;
  });

  return config;
}

module.exports = createRunOncePlugin(withRongCloudIosPush, TAG, '1.0.0');
