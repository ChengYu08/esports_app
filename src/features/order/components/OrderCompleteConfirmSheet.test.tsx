import { createRequire } from "node:module";
import { useState, type ElementType, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderItemModel } from "../order.types";

vi.mock("@fluentui/react-native-icons", () => ({
  ChevronDoubleRight16Regular: "Icon", Dismiss16Regular: "Icon", DismissCircle16Filled: "Icon",
  Checkmark16Regular: "Icon", ErrorCircle16Regular: "Icon", Search24Regular: "Icon",
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native", () => ({
  Keyboard: { dismiss: vi.fn() },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Modal: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? <>{children}</> : null,
  Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View",
  FlatList: ({ data, renderItem }: { data: unknown[]; renderItem: (args: { item: unknown }) => ReactNode }) => <>{data.map((item) => renderItem({ item }))}</>,
  StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} },
  useWindowDimensions: () => ({ height: 800, width: 400 }),
}));
vi.mock("@/shared/ui/CachedImage", () => ({ CachedImage: "Image" }));
vi.mock("@/shared/theme/typography", () => ({ SYSTEM_FONT: "System" }));
// 模拟 iOS：抽屉只展示自身内容及 overlay，不接受页面上的第二个 Modal。
vi.mock("@/shared/ui/BottomSheet", () => ({
  BottomSheet: ({ visible, children, overlay }: { visible: boolean; children: ReactNode; overlay?: ReactNode }) =>
    visible ? <>{children}{overlay}</> : null,
}));

const nodeRequire = createRequire(import.meta.url);
for (const extension of [".png", ".webp"]) {
  nodeRequire.extensions[extension] = (module) => { module.exports = 1; };
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { OrderCompleteConfirmSheet } = await import("./OrderCompleteConfirmSheet");
const { AppPrompt } = await import("@/shared/ui/AppPrompt");
const { OrderMultiCompanionSheet } = await import("./OrderMultiCompanionSheet");
const PressableHost = "Pressable" as unknown as ElementType;
const order = { id: "1", quantity: 1, totalPrice: "440", sellerName: "玩家" } as OrderItemModel;
let renderer: ReactTestRenderer;

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer.unmount());
  }
});

function Harness({ submit, close, freeOrder = false }: { submit: () => Promise<void>; close: () => void; freeOrder?: boolean }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    try {
      await submit();
    } finally {
      setLoading(false);
    }
  };
  return <OrderCompleteConfirmSheet visible freeOrder={freeOrder} order={order} companionName="陪玩" serviceTime="" loading={loading} onClose={close} onConfirm={confirm} onConfirmFree={confirm} />;
}

describe("完成订单失败提示与恢复操作", () => {
  it("免单失败在抽屉内提示，保留输入并可重试", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error("免单失败，请稍后重试")).mockResolvedValueOnce(undefined);
    await act(async () => { renderer = create(<Harness submit={submit} close={vi.fn()} freeOrder />); });
    const input = () => renderer.root.findByType("TextInput" as unknown as ElementType);
    await act(async () => { input().props.onChangeText("0.5"); });
    const button = () => renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityState !== undefined)!;
    await act(async () => { await button().props.onPress(); });
    const prompt = renderer.root.findByType(AppPrompt);
    expect(prompt.props.inline).toBe(true);
    expect(prompt.props.title).toBe("免单失败");
    expect(prompt.props.visible).toBe(true);
    expect(input().props.value).toBe("0.5");
    expect(button().props.disabled).toBe(false);
    await act(async () => { prompt.props.onConfirm(); });
    await act(async () => { await button().props.onPress(); });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("多人开始服务失败在选人抽屉内提示并保留选择", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error("网络异常")).mockResolvedValueOnce(undefined);
    await act(async () => { renderer = create(<OrderMultiCompanionSheet visible needSelect={1} candidates={[{ userId: 2 }]} onClose={vi.fn()} onConfirm={submit} />); });
    await act(async () => { renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityRole === "checkbox")!.props.onPress(); });
    const button = () => renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityLabel === "确认并开始服务")!;
    await act(async () => { await button().props.onPress(); });
    const prompt = renderer.root.findByType(AppPrompt);
    expect(prompt.props.inline).toBe(true);
    expect(prompt.props.message).toBe("网络异常");
    expect(button().props.disabled).toBe(false);
    await act(async () => { prompt.props.onConfirm(); });
    await act(async () => { await button().props.onPress(); });
    expect(submit).toHaveBeenNthCalledWith(2, [2]);
  });
  it.each(["订单服务时间过短，请稍后再试！", "网络连接失败，请检查网络后重试"])("%s 在当前抽屉内可见，关闭提示后可重试", async (message) => {
    const submit = vi.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce(undefined);
    const close = vi.fn();
    await act(async () => { renderer = create(<Harness submit={submit} close={close} />); });
    const confirmButton = () => renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityState !== undefined)!;
    await act(async () => { await confirmButton().props.onPress(); });
    const prompt = renderer.root.findByType(AppPrompt);
    expect(prompt.props.inline).toBe(true);
    expect(prompt.props.visible).toBe(true);
    expect(prompt.props.message).toBe(message);
    expect(confirmButton().props.disabled).toBe(false);
    await act(async () => { prompt.props.onConfirm(); });
    expect(renderer.root.findAllByType(AppPrompt).filter((node) => node.props.visible)).toHaveLength(0);
    await act(async () => { await confirmButton().props.onPress(); });
    expect(submit).toHaveBeenCalledTimes(2);
    await act(async () => {
      renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityLabel === "关闭确认完成订单弹窗")!.props.onPress();
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
