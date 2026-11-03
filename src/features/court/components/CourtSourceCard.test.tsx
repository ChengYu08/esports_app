import { createRequire } from "node:module";
import { Profiler, type ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CourtSource } from "../court.api";
import { CourtSourceCard } from "./CourtSourceCard";

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".svg"] = (module) => {
  module.exports = 1;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const PressableHost = "Pressable" as unknown as ElementType;
const TextHost = "Text" as unknown as ElementType;
const CachedImageHost = "CachedImage" as unknown as ElementType;

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("@/shared/ui/CachedImage", () => ({ CachedImage: "CachedImage" }));
vi.mock("./CourtAvatar", () => ({ CourtAvatar: "CourtAvatar" }));

const source: CourtSource = {
  orderId: 100,
  reviewId: 1,
  orderNo: "202610220001",
  gameId: 1,
  gameIconUrl: "https://cdn.example.com/game.png",
  gameName: "三角洲行动",
  modeName: "排位",
  levelName: "钻石",
  serviceName: "陪玩",
  companionNickname: "测试陪玩师",
  companionAvatar: "https://cdn.example.com/avatar.png",
  defendantId: 200,
  defendantNickname: "测试用户",
  defendantAvatar: "https://cdn.example.com/defendant.png",
  clubName: "测试俱乐部",
  totalPrice: 88,
  quantity: 1,
  billingUnitName: "小时",
  createdAt: "2026-10-22T10:00:00",
  reviewContent: "测试评价",
  reviewRating: 5,
  reviewImageUrls: [],
};

let renderer: ReactTestRenderer | undefined;
const selectSource = () => undefined;

function card(
  onRender: () => void,
  props: Partial<Parameters<typeof CourtSourceCard>[0]> = {},
) {
  return (
    <Profiler id="court-source-card" onRender={onRender}>
      <CourtSourceCard
        source={source}
        kind="order"
        selected={false}
        onSelect={selectSource}
        {...props}
      />
    </Profiler>
  );
}

async function update(element: ReturnType<typeof card>) {
  await act(async () => {
    if (renderer) {
      renderer.update(element);
    } else {
      renderer = create(element);
    }
  });
}

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

describe("CourtSourceCard rendering", () => {
  it("skips rendering when all row props are unchanged", async () => {
    await update(card(vi.fn(), { keyword: "2200" }));
    const initialProps = renderer?.root.findByType(PressableHost).props;

    await update(card(vi.fn(), { keyword: "2200" }));

    expect(renderer?.root.findByType(PressableHost).props).toBe(initialProps);
  });

  it("updates selection, disabled state and order number highlighting", async () => {
    const onRender = vi.fn();
    await update(card(onRender));
    await update(
      card(onRender, { selected: true, disabled: true, keyword: "2200" }),
    );

    const pressable = renderer?.root.findByType(PressableHost);
    expect(pressable?.props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });
    expect(pressable?.props.disabled).toBe(true);
    const highlights = renderer?.root.findAll(
      (node) => node.type === TextHost && node.props.children === "2200",
    );
    expect(highlights).toHaveLength(1);
    expect(highlights?.[0].props.style).toEqual({ color: "#FE1F4C" });
  });

  it("keeps the local game icon failure fallback", async () => {
    await update(card(vi.fn()));
    const image = renderer?.root.findAllByType(CachedImageHost).find(
      (node) => node.props.recyclingKey === source.gameIconUrl,
    );

    await act(async () => image?.props.onError());

    expect(image?.props.source).toBe(1);
  });
});
