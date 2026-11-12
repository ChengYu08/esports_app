import { type ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "expo-router";

import { CircleContentText } from "./CircleContentText";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TextHost = "Text" as unknown as ElementType;

vi.mock("react-native", () => ({ Text: "Text" }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));

let renderer: ReactTestRenderer | undefined;

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
  vi.mocked(router.push).mockClear();
});

describe("CircleContentText topic links", () => {
  it("正文和附加话题都可点击并传入完整话题名", async () => {
    await act(async () => {
      renderer = create(
        <CircleContentText
          content="看看#五杀时刻"
          tags={["##电竞赛事"]}
        />,
      );
    });

    const links = renderer?.root.findAll(
      (node) => node.type === TextHost && node.props.accessibilityRole === "link",
    );
    expect(links?.map((node) => node.props.accessibilityLabel)).toEqual([
      "查看话题五杀时刻",
      "查看话题电竞赛事",
    ]);
    const rootText = renderer?.root.findAllByType(TextHost)[0];
    expect(links?.every((node) => node.parent === rootText)).toBe(true);

    await act(async () => {
      links?.[0].props.onPress();
      links?.[1].props.onPress();
    });

    expect(router.push).toHaveBeenNthCalledWith(1, {
      pathname: "/circle/search",
      params: { topic: "五杀时刻" },
    });
    expect(router.push).toHaveBeenNthCalledWith(2, {
      pathname: "/circle/search",
      params: { topic: "电竞赛事" },
    });
  });
});
