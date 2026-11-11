import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storageMock, linkingMock, linksMock, toolkitMock } = vi.hoisted(() => ({
  storageMock: { set: vi.fn() },
  linkingMock: { openURL: vi.fn() },
  toolkitMock: { markPrivacyConsentAccepted: vi.fn() },
  linksMock: {
    userAgreement: "https://example.test/protocols?code=user_server",
    privacyPolicy: "https://example.test/protocols?code=user_privacy",
  },
}));

vi.mock("react-native", () => ({
  BackHandler: { exitApp: vi.fn() },
  Modal: ({ children }: { children: React.ReactNode }) => children,
  Platform: {
    OS: "android",
    select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
      options.android ?? options.default,
  },
  Pressable: "Pressable",
  ScrollView: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: {
    hairlineWidth: 0.5,
    create: <T,>(styles: T) => styles,
  },
  Text: "Text",
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native-webview", () => ({ WebView: "WebView" }));
vi.mock("react-native/Libraries/Linking/Linking", () => linkingMock);
vi.mock("@/shared/navigation/open-external-link", () => ({
  openExternalLink: linkingMock.openURL,
}));
vi.mock("@/core/config/links", () => ({ APP_LINKS: linksMock }));
vi.mock("@/core/storage/storage", () => ({ storage: storageMock }));
vi.mock("@/shared/ui/ScreenHeader", () => ({ ScreenHeader: "ScreenHeader" }));
vi.mock("../../../../modules/expo-app-toolkit", () => ({
  default: toolkitMock,
}));

const { WEBVIEW_COMPAT_SCRIPT } = await import(
  "@/shared/navigation/webview-compat-script"
);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { createRequire } = await import("node:module");
const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".svg"] = (module) => {
  module.exports = 1;
};

const { PrivacyConsentGate } = await import(
  "@/features/privacy/components/PrivacyConsentGate"
);

const TextHost = "Text" as unknown as ElementType;
const WebViewHost = "WebView" as unknown as ElementType;
const ScreenHeaderHost = "ScreenHeader" as unknown as ElementType;
const PressableHost = "Pressable" as unknown as ElementType;

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.set.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

function pressProtocolLink(label: string) {
  const link = renderer?.root
    .findAllByType(TextHost)
    .find((node) => node.props.children === label);
  act(() => link?.props.onPress());
}

describe("PrivacyConsentGate 协议查看", () => {
  it("点击《用户协议》《隐私政策》用内置协议层打开，不再跳外部浏览器", async () => {
    await act(async () => {
      renderer = create(<PrivacyConsentGate onAccepted={() => undefined} />);
    });

    // 初始没有协议层
    expect(renderer?.root.findAllByType(WebViewHost).length).toBe(0);

    pressProtocolLink("《用户协议》");
    expect(renderer?.root.findAllByType(WebViewHost).length).toBe(1);
    expect(linkingMock.openURL).not.toHaveBeenCalled();

    // 关闭后协议层消失，隐私政策链接可再次打开
    const header = renderer?.root.findAllByType(ScreenHeaderHost)[0];
    await act(async () => header?.props.onBack());
    expect(renderer?.root.findAllByType(WebViewHost).length).toBe(0);

    pressProtocolLink("《隐私政策》");
    expect(renderer?.root.findAllByType(WebViewHost).length).toBe(1);
    expect(linkingMock.openURL).not.toHaveBeenCalled();
  });

  it("协议层 WebView 加载对应链接且标题正确", async () => {
    await act(async () => {
      renderer = create(<PrivacyConsentGate onAccepted={() => undefined} />);
    });
    pressProtocolLink("《用户协议》");
    const webView = renderer?.root.findByType(WebViewHost);
    expect(webView?.props.source).toEqual({ uri: linksMock.userAgreement });
    // 旧 WebView 缺少 Array.prototype.at 等 API，必须注入兼容补丁
    expect(webView?.props.injectedJavaScriptBeforeContentLoaded).toBe(
      WEBVIEW_COMPAT_SCRIPT,
    );
    expect(renderer?.root.findAllByType(ScreenHeaderHost)[0]?.props.title).toBe(
      "用户协议",
    );
  });
});

describe("PrivacyConsentGate 隐私同意", () => {
  it("原生初始化抛错时仍保存同意状态并进入应用", async () => {
    toolkitMock.markPrivacyConsentAccepted.mockImplementationOnce(() => {
      throw new Error("native method unavailable");
    });
    const onAccepted = vi.fn();

    await act(async () => {
      renderer = create(<PrivacyConsentGate onAccepted={onAccepted} />);
    });

    const acceptButton = renderer?.root
      .findAllByType(PressableHost)
      .find((node) => node.props.accessibilityLabel === "同意并继续使用");
    await act(async () => acceptButton?.props.onPress());

    expect(storageMock.set).toHaveBeenCalledWith(
      "esports.privacy.consent.v1",
      "accepted",
    );
    expect(onAccepted).toHaveBeenCalledOnce();
  });
});
