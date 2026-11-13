import { createRequire } from "node:module";
import type { ElementType, ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pay, balance } = vi.hoisted(() => ({ pay: vi.fn(), balance: vi.fn() }));
vi.mock("@/features/mine/api/companion-order.api", () => ({ payCompanionOrder: pay, fetchStarBalance: balance }));
vi.mock("@/features/match/api/match.api", () => ({ StarNotEnoughError: class extends Error {} }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() }, useFocusEffect: () => {} }));
vi.mock("@/features/mine/hooks/use-star-balance", () => ({ useStarBalance: () => 100 }));
vi.mock("@fluentui/react-native-icons", () => ({ Dismiss16Regular: "Icon" }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/features/match/components/MatchLinearGradient", () => ({ MatchLinearGradient: "Gradient" }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock("react-native", () => ({
  Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView",
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Modal: "Modal", StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} },
}));
vi.mock("@/shared/ui/BottomSheet", () => ({
  BottomSheet: ({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) => <>{children}{overlay}</>,
}));
const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".png"] = (module) => { module.exports = 1; };
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { StarPaymentPrompt } = await import("./StarPaymentPrompt");
const { StarPaymentSheet } = await import("@/features/mine/components/StarPaymentSheet");
const { AppPrompt } = await import("@/shared/ui/AppPrompt");
const PressableHost = "Pressable" as unknown as ElementType;
let renderer: ReactTestRenderer;
beforeEach(() => { vi.clearAllMocks(); balance.mockResolvedValue(100); });
afterEach(async () => { if (renderer) { await act(async () => renderer.unmount()); } });

describe.each(["订单", "资料页"])("%s 支付网络异常", (entry) => {
  it("在当前弹层显示错误，恢复按钮，允许重试成功", async () => {
    const onClose = vi.fn();
    const onPaid = vi.fn();
    pay.mockRejectedValueOnce(new Error("网络连接失败")).mockResolvedValueOnce(undefined);
    await act(async () => {
      renderer = create(entry === "订单"
        ? <StarPaymentPrompt item={{ id: "1", totalPrice: "50" } as never} token="test" onClose={onClose} onPaid={onPaid} />
        : <StarPaymentSheet order={{ orderId: 1, total: 50 }} visible token="test" onClose={onClose} onPaid={onPaid} />);
    });
    const button = () => renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityLabel === "确认支付")!;
    await act(async () => { await button().props.onPress(); });
    const prompt = renderer.root.findByType(AppPrompt);
    expect(prompt.props.visible).toBe(true);
    expect(prompt.props.inline).toBe(true);
    expect(prompt.props.message).toBe("网络连接失败");
    expect(button().props.disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { prompt.props.onConfirm(); });
    await act(async () => { await button().props.onPress(); });
    expect(onPaid).toHaveBeenCalledOnce();
  });
});

it("订单余额查询失败可在当前弹层重试，恢复支付按钮", async () => {
  balance.mockRejectedValueOnce(new Error("网络异常")).mockResolvedValueOnce(100);
  await act(async () => { renderer = create(<StarPaymentPrompt item={{ id: "1", totalPrice: "50" } as never} token="test" onClose={vi.fn()} onPaid={vi.fn()} />); });
  const prompt = renderer.root.findByType(AppPrompt);
  expect(prompt.props.confirmText).toBe("重试");
  await act(async () => { prompt.props.onConfirm(); });
  expect(balance).toHaveBeenCalledTimes(2);
  const button = renderer.root.findAllByType(PressableHost).find((node) => node.props.accessibilityLabel === "确认支付")!;
  expect(button.props.disabled).toBe(false);
});
