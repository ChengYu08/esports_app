import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import WebViewScreen from "@/features/navigation/screens/WebViewScreen";
import { WEBVIEW_COMPAT_SCRIPT } from "@/shared/navigation/webview-compat-script";

vi.mock("expo-router", () => ({
  router: { back: vi.fn() },
  useLocalSearchParams: () => ({
    url: "https://example.test/protocols?code=user_server",
    title: "用户协议",
  }),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: {
    absoluteFill: {},
    hairlineWidth: 0.5,
    create: <T,>(styles: T) => styles,
  },
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native-webview", () => ({ WebView: "WebView" }));
vi.mock("@/shared/ui/ScreenHeader", () => ({ ScreenHeader: "ScreenHeader" }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const WebViewHost = "WebView" as unknown as ElementType;
const ScreenHeaderHost = "ScreenHeader" as unknown as ElementType;

let renderer: ReactTestRenderer | undefined;

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

describe("WebViewScreen", () => {
  it("打开内嵌页时注入旧 WebView 兼容补丁", async () => {
    await act(async () => {
      renderer = create(<WebViewScreen />);
    });

    const webView = renderer?.root.findByType(WebViewHost);
    expect(webView?.props.source).toEqual({
      uri: "https://example.test/protocols?code=user_server",
    });
    // Android 11 自带 WebView 缺少 Array.prototype.at 等 API，缺失补丁会导致协议页报错
    expect(webView?.props.injectedJavaScriptBeforeContentLoaded).toBe(
      WEBVIEW_COMPAT_SCRIPT,
    );
    expect(renderer?.root.findByType(ScreenHeaderHost)?.props.title).toBe(
      "用户协议",
    );
  });
});
