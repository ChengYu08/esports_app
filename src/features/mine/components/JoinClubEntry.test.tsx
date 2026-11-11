import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinClubEntry } from "./JoinClubEntry";

const mock = vi.hoisted(() => ({
  state: { accessToken: "token", user: { id: "1", clubInfo: null as { id: number } | null } },
  application: null as { status: string } | null,
  push: vi.fn(),
}));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) }, Pressable: "Pressable", Text: "Text", StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock("expo-router", () => ({ router: { push: mock.push }, useFocusEffect: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mock.application, refetch: vi.fn() }) }));
vi.mock("@esports/auth", () => ({ useAuthStore: Object.assign((select: (state: typeof mock.state) => unknown) => select(mock.state), { setState: vi.fn() }) }));
vi.mock("@/features/auth/client-auth.api", () => ({ clientAuthApi: { fetchCurrentUser: vi.fn() } }));
vi.mock("@/features/mine/api/club-join.api", () => ({ fetchClubJoinState: vi.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
  }
  renderer = undefined;
  mock.state.user.clubInfo = null;
  mock.application = null;
  vi.clearAllMocks();
});
describe("加入俱乐部入口", () => {
  it("未加入时显示入口，并打开申请页面", () => {
    act(() => { renderer = create(<JoinClubEntry />); });
    const button = renderer!.root.findByProps({ accessibilityRole: "button" });
    expect(button.props.accessibilityLabel).toBe("加入俱乐部");
    act(() => button.props.onPress());
    expect(mock.push).toHaveBeenCalledWith("/join-club");
  });
  it("申请审核中时展示待审核状态", () => {
    mock.application = { status: "PENDING" };
    act(() => { renderer = create(<JoinClubEntry />); });
    expect(renderer!.root.findByProps({ accessibilityRole: "button" }).props.accessibilityLabel).toBe("申请待审核");
  });
  it("已有俱乐部时隐藏入口", () => {
    mock.state.user.clubInfo = { id: 9 };
    act(() => { renderer = create(<JoinClubEntry />); });
    expect(renderer!.toJSON()).toBeNull();
  });
});
