import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const mocks = vi.hoisted(() => ({
  user: { id: "1", isRealName: 1, clubInfo: null as { id: number } | null },
  application: null as null | { id: number; clubName: string; status: string },
  error: false,
  submit: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", Text: "Text", TextInput: "TextInput", View: "View",
    StyleSheet: { hairlineWidth: 1, create: (styles: unknown) => styles },
    FlatList: ({ data, renderItem }: { data: unknown[]; renderItem: (value: { item: unknown }) => unknown }) => React.createElement("View", null, data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item }) as never))),
  };
});
vi.mock("expo-router", () => ({ router: { push: mocks.push, back: vi.fn() } }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("@esports/auth", () => {
  const state = () => ({ accessToken: "token", user: mocks.user });
  return { useAuthStore: Object.assign((select: (value: ReturnType<typeof state>) => unknown) => select(state()), { getState: state }) };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.application, isSuccess: !mocks.error, isError: mocks.error, isPending: false, isFetching: false, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useInfiniteQuery: () => ({ data: { pages: [{ records: [{ id: 12, clubName: "测试俱乐部" }], total: 1 }] }, hasNextPage: false, isPending: false, isError: false, isFetchingNextPage: false }),
}));
vi.mock("@/features/mine/api/club-join.api", () => ({ fetchClubJoinState: vi.fn(), fetchJoinClubs: vi.fn(), submitClubJoin: mocks.submit, cancelClubJoin: mocks.cancel }));
vi.mock("@/features/mine/components/JoinClubEntry", () => ({ clubJoinStateKey: (token: string) => ["club-join", "state", token] }));
vi.mock("@/features/mine/hooks/use-club-join-refresh", () => ({ useClubJoinRefresh: vi.fn() }));
vi.mock("@/shared/ui/ScreenHeader", () => ({ ScreenHeader: "ScreenHeader" }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
createRequire(import.meta.url).extensions[".svg"] = (module) => {
  module.exports = 1;
};
const { default: JoinClubScreen } = await import("./JoinClubScreen");
let renderer: ReactTestRenderer | undefined;
function render() {
  act(() => { renderer = create(<JoinClubScreen />); });
}
function textContent() {
  return renderer!.root.findAllByType("Text" as never).map((node) => node.children.join(""));
}
afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
  }
  renderer = undefined;
  mocks.user.isRealName = 1;
  mocks.user.clubInfo = null;
  mocks.application = null;
  mocks.error = false;
  vi.clearAllMocks();
});

describe("加入俱乐部申请页面", () => {
  it("未实名时引导到实名认证", () => {
    mocks.user.isRealName = 0;
    render();
    expect(textContent()).toContain("加入俱乐部需要先完成实名认证");
    act(() => renderer!.root.findByProps({ accessibilityRole: "button" }).props.onPress());
    expect(mocks.push).toHaveBeenCalledWith("/real-name-verification");
  });
  it("选择俱乐部后提交申请", async () => {
    render();
    act(() => renderer!.root.findByProps({ accessibilityRole: "radio" }).props.onPress());
    const button = renderer!.root.findAllByProps({ accessibilityRole: "button" }).find((node) => node.findAllByType("Text" as never).some((text) => text.children.join("") === "提交申请"));
    expect(button?.props.disabled).toBe(false);
    await act(async () => { button!.props.onPress(); });
    expect(mocks.submit).toHaveBeenCalledWith("token", 12);
    expect(mocks.invalidate).toHaveBeenCalled();
  });
  it("审核中可以取消申请", async () => {
    mocks.application = { id: 8, clubName: "测试俱乐部", status: "PENDING" };
    render();
    expect(textContent()).toContain("申请待审核");
    await act(async () => { renderer!.root.findByProps({ accessibilityRole: "button" }).props.onPress(); });
    expect(mocks.cancel).toHaveBeenCalledWith("token", 8);
  });
  it("申请已通过但身份未同步时不能重复申请", () => {
    mocks.application = { id: 8, clubName: "测试俱乐部", status: "APPROVED" };
    render();
    expect(textContent()).toContain("申请已通过");
    expect(renderer!.root.findAllByProps({ accessibilityRole: "radio" })).toHaveLength(0);
  });
  it("申请状态失败时禁止提交", () => {
    mocks.error = true;
    render();
    expect(textContent()).toContain("申请状态加载失败");
    expect(renderer!.root.findAllByProps({ accessibilityRole: "radio" })).toHaveLength(0);
  });
});
