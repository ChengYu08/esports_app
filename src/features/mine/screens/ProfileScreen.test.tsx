import { createRequire } from "node:module";
import type { ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authState } = vi.hoisted(() => ({
  authState: {
    accessToken: "token-a",
    user: {
      id: "account-a",
      nickname: "我的昵称",
      signature: "",
      headImage: undefined,
      gender: 0,
      clubInfo: undefined,
    },
  },
}));

vi.mock("react-native", () => {
  class AnimatedValue {
    interpolate() {
      return new AnimatedValue();
    }
  }

  return {
    Animated: {
      Value: AnimatedValue,
      View: "AnimatedView",
      FlatList: "FlatList",
      event: () => vi.fn(),
    },
    Pressable: "Pressable",
    Platform: {
      OS: "android",
      select: <T,>(options: { android: T }) => options.android,
    },
    ScrollView: "ScrollView",
    StyleSheet: {
      absoluteFill: {},
      create: <T,>(styles: T) => styles,
    },
    Text: "Text",
    View: "View",
  };
});
vi.mock("@fluentui/react-native-icons", () => ({
  ChevronLeft24Regular: "ChevronLeft24Regular",
  MoreHorizontal24Regular: "MoreHorizontal24Regular",
  Search24Regular: "Search24Regular",
  Star16Filled: "Star16Filled",
  Star16Regular: "Star16Regular",
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("expo-router", () => ({
  router: { back: vi.fn(), dismissTo: vi.fn(), push: vi.fn() },
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  ),
}));
vi.mock("@/features/mine/hooks/use-profile-data", () => ({
  useProfileDetail: () => ({ data: undefined, isLoading: false, isError: false }),
  useProfileGameDetail: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
  }),
  useProfileReviews: () => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/features/mine/hooks/use-user-follow", () => ({
  useUserFollowState: () => ({ data: undefined, isLoading: false }),
  useToggleUserFollow: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/features/mine/hooks/use-customer-service-entry", () => ({
  useCustomerServiceEntry: () => ({
    entering: false,
    openCustomerService: vi.fn(),
  }),
}));
vi.mock("@/features/mine/blacklist", () => ({
  addToBlacklist: vi.fn(),
  isUserBlacklisted: vi.fn().mockResolvedValue(false),
  removeFromBlacklist: vi.fn(),
  subscribeBlacklist: vi.fn(() => vi.fn()),
}));
vi.mock("@/shared/audio/use-voice-player", () => ({
  useVoicePlayer: () => ({ stop: vi.fn(), toggle: vi.fn(), playingUrl: null }),
}));
vi.mock("@/shared/audio/VoicePlayButton", () => ({ VoicePlayButton: "VoicePlayButton" }));
vi.mock("@/shared/navigation/require-login", () => ({ requireLogin: () => true }));
vi.mock("@/shared/ui/CachedImage", () => ({ CachedImage: "CachedImage" }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn() }));
vi.mock("@/shared/ui/AppPrompt", () => ({ AppPrompt: "AppPrompt" }));
vi.mock("@/shared/ui/AsyncStates", () => ({ EmptyState: "EmptyState" }));
vi.mock("@/features/mine/components/CompanionOrderSheet", () => ({
  CompanionOrderSheet: "CompanionOrderSheet",
}));
vi.mock("@/features/mine/components/ProfileActionsSheet", () => ({
  ProfileActionsSheet: "ProfileActionsSheet",
}));
vi.mock("@/features/mine/components/ProfileSkeleton", () => ({
  ProfileGameSkeleton: "ProfileGameSkeleton",
  ProfileSkeleton: "ProfileSkeleton",
}));
vi.mock("@/features/mine/components/StarPaymentSheet", () => ({
  StarPaymentSheet: "StarPaymentSheet",
}));
vi.mock("@/features/order/order-query", () => ({
  invalidateOrderQueries: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".png"] = (module) => {
  module.exports = 1;
};
nodeRequire.extensions[".webp"] = (module) => {
  module.exports = 1;
};
nodeRequire.extensions[".svg"] = (module) => {
  module.exports = 1;
};

const { default: ProfileScreen } = await import("./ProfileScreen");
const PressableHost = "Pressable" as unknown as ElementType;
let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

describe("ProfileScreen 个人资料入口", () => {
  it("自己的主页保留编辑个人资料且不显示右上角设置", async () => {
    await act(async () => {
      renderer = create(<ProfileScreen />);
    });

    const labels = renderer?.root
      .findAllByType(PressableHost)
      .map((node) => node.props.accessibilityLabel);
    expect(labels).toContain("编辑个人资料");
    expect(labels).not.toContain("设置");
  });
});
