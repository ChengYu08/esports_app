const {
  createRunOncePlugin,
  withInfoPlist,
  withAppDelegate,
  withEntitlementsPlist,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-ios-push';

// MARKER comments let us remove old generated code on re-prebuild
const MARKER = '// RongCloudPush:';

// 1. Import UserNotifications (must be at file scope, top of file)
const IMPORT_SNIPPET = `import UserNotifications
`;

// 2. Request push authorization + register for remote notifications.
//    AppDelegate is already UIApplicationDelegate (via ExpoAppDelegate), so no conformance needed.
const APP_DELEGATE_SNIPPET = `
    ${MARKER} request authorization and register for remote notifications
    let rongPushCenter = UNUserNotificationCenter.current()
    rongPushCenter.delegate = self
    rongPushCenter.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
      if granted {
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      }
    }
`;

// 3. Forward APNs deviceToken to RongCloud SDK before any JS connect() call
const DEVICE_TOKEN_HANDLER = `
  ${MARKER} forward APNs deviceToken to RongCloud SDK
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    RongCloudPushHandler.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
  }
`;

// 3b. Capture cold-start notification from launchOptions (before JS is ready)
const LAUNCH_OPTIONS_CAPTURE = `
    // RongCloudPush: capture cold-start push notification
    if let rongRemoteNotification = launchOptions?[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
       let rongRcData = rongRemoteNotification["rc"] as? [String: Any] {
      let rongTargetId = rongRcData["tId"] as? String ?? ""
      if !rongTargetId.isEmpty {
        UserDefaults.standard.set(["targetId": rongTargetId], forKey: "rongPushPendingClick")
      }
    }
`;

// 3b-2. Insert cold-start capture AFTER super.application() returns, avoiding race with JS init
const LAUNCH_OPTIONS_INJECTION = `
    let rongLaunchResult = super.application(application, didFinishLaunchingWithOptions: launchOptions)
${LAUNCH_OPTIONS_CAPTURE}
    return rongLaunchResult
`;

// 3c. Handle notification tap → save targetId for JS to read on next launch
const NOTIFICATION_TAP_HANDLER = `
  ${MARKER} handle notification tap
  public override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    if let rcData = userInfo["rc"] as? [String: Any] {
      let targetId = rcData["tId"] as? String ?? ""
      let conversationType = rcData["cType"] as? String ?? ""
      if !targetId.isEmpty {
        UserDefaults.standard.set(
          ["targetId": targetId, "conversationType": conversationType],
          forKey: "rongPushPendingClick"
        )
      }
    }
    completionHandler()
  }
`;

// 4. Handler class (imports RongIMWrapper, calls setDeviceToken)
const HANDLER_CLASS = `
${MARKER} push handler
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

  // 2. Add aps-environment entitlement (required for APNs on iOS)
  config = withEntitlementsPlist(config, (mod) => {
    if (!mod.modResults['aps-environment']) {
      // Use 'development' for debug builds; EAS production builds will use 'production'
      mod.modResults['aps-environment'] =
        process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development';
    }
    return mod;
  });

  // 3. Inject push registration into AppDelegate.swift
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error(`${TAG} requires Swift AppDelegate.`);
    }
    if (mod.modResults.contents.includes(MARKER)) return mod;

    // 3a. Add UserNotifications import at the very top (before all other imports)
    mod.modResults.contents = IMPORT_SNIPPET + mod.modResults.contents;

    // 3b. Insert authorization request after factory.startReactNative(...) call
    mod.modResults.contents = mod.modResults.contents.replace(
      /(factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\n)/,
      `$1\n${APP_DELEGATE_SNIPPET}`,
    );

    // 3c. Replace "return super.application(...)" with capture + return pattern
    mod.modResults.contents = mod.modResults.contents.replace(
      /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
      `${LAUNCH_OPTIONS_INJECTION.trim()}`,
    );

    // 3d. Insert deviceToken handler into AppDelegate class body
    //     (AppDelegate class ends right before "class ReactNativeDelegate")
    const classBoundary = mod.modResults.contents.indexOf('class ReactNativeDelegate');
    if (classBoundary !== -1) {
      const beforeBoundary = mod.modResults.contents.slice(0, classBoundary);
      const lastClose = beforeBoundary.lastIndexOf('}');
      if (lastClose !== -1) {
        mod.modResults.contents =
          beforeBoundary.slice(0, lastClose) +
          DEVICE_TOKEN_HANDLER +
          NOTIFICATION_TAP_HANDLER +
          beforeBoundary.slice(lastClose) +
          mod.modResults.contents.slice(classBoundary);
      }
    }

    // 3e. Append handler class at end of file
    mod.modResults.contents += HANDLER_CLASS;

    return mod;
  });

  return config;
}

module.exports = createRunOncePlugin(withRongCloudIosPush, TAG, '1.1.0');
