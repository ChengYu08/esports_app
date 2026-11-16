import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMatchForm } from "./use-match-form";

vi.mock("@/features/match/api/match.api", () => ({}));
vi.mock("@esports/auth", () => ({ useAuthStore: (selector: (state: { accessToken: string }) => unknown) => selector({ accessToken: "token" }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: {
      modes: [{ id: "mode", name: "模式" }],
      levels: [{ id: "level", name: "等级" }],
      services: [
        { id: "hidden", name: "隐藏", malePrice: 1, femalePrice: 1, supportMultiCompanion: false, companionPreferenceDisplay: 0 },
        { id: "single", name: "单陪", malePrice: 10, femalePrice: 20, supportMultiCompanion: true, companionPreferenceDisplay: 1 },
        { id: "double", name: "双陪", malePrice: 10, femalePrice: 20, supportMultiCompanion: false, companionPreferenceDisplay: 2 },
      ],
    }[queryKey[1] as string],
    isLoading: false,
    isFetching: false,
  }),
}));

let form: ReturnType<typeof useMatchForm>;
let renderer: ReactTestRenderer;
const options = { lockedClub: { id: "club", name: "俱乐部" }, providedGames: [{ id: "game", name: "游戏" }] };
function Form() {
  form = useMatchForm(options);
  return null;
}

afterEach(() => {
  if (renderer) {
    act(() => renderer.unmount());
  }
});

describe("快速发单单双陪配置", () => {
  it("按服务配置显隐和设置默认值，并保留同一服务的手动选择", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => { renderer = create(<Form />); });
    act(() => form.selectMode("mode"));
    act(() => form.selectLevel("level"));
    act(() => form.selectService("single"));
    expect(form.showCompanionPreference).toBe(true);
    expect(form.companionPreference).toBe(1);
    expect(form.estimatedPriceText).toBe("10~20");
    act(() => form.setCompanionPreference(2));
    expect(form.estimatedPriceText).toBe("20~40");
    act(() => form.setQuantity(3));
    expect(form.estimatedPriceText).toBe("60~120");
    act(() => form.setGender(1));
    expect(form.estimatedPriceText).toBe("60");
    act(() => form.setGender(2));
    expect(form.estimatedPriceText).toBe("120");
    act(() => form.selectService("single"));
    expect(form.companionPreference).toBe(2);
    act(() => form.selectService("double"));
    expect(form.showCompanionPreference).toBe(true);
    expect(form.companionPreference).toBe(2);
    act(() => form.selectService("hidden"));
    expect(form.showCompanionPreference).toBe(false);
    expect(form.companionPreference).toBeNull();
    act(() => form.selectService("single"));
    expect(form.companionPreference).toBe(1);
  });
});
