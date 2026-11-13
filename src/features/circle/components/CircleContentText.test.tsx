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

  it("带位置的 @用户 使用独立样式并跳转对应用户", async () => {
    const linkStyle = { color: "#1540AD" };
    const mentionStyle = { color: "#FFD04D" };
    await act(async () => {
      renderer = create(
        <CircleContentText
          content="@张三 #五杀"
          mentions={[{ id: "42", label: "张三", offset: 0, length: 3 }]}
          linkStyle={linkStyle}
          mentionStyle={mentionStyle}
        />,
      );
    });

    const links = renderer?.root.findAll(
      (node) => node.type === TextHost && node.props.accessibilityRole === "link",
    );
    expect(links?.map((node) => node.props.style)).toEqual([mentionStyle, linkStyle]);

    await act(async () => {
      links?.[0].props.onPress();
      links?.[1].props.onPress();
    });

    expect(router.push).toHaveBeenNthCalledWith(1, {
      pathname: "/profile",
      params: { userId: "42" },
    });
    expect(router.push).toHaveBeenNthCalledWith(2, {
      pathname: "/circle/search",
      params: { topic: "五杀" },
    });
  });

  it("未绑定用户 ID 的 @xx 在评论和视频描述里仍有样式", async () => {
    const linkStyle = { color: "#1540AD" };
    const mentionStyle = { color: "#FFD04D" };
    await act(async () => {
      renderer = create(
        <CircleContentText
          content="提到 @xx 和 #五杀"
          linkStyle={linkStyle}
          mentionStyle={mentionStyle}
        />,
      );
    });

    const styled = renderer?.root.findAll(
      (node) => node.type === TextHost && (node.props.style === mentionStyle || node.props.style === linkStyle),
    );
    expect(styled?.map((node) => node.props.children)).toEqual(["@xx", "#五杀"]);
    expect(styled?.[0].props.accessibilityRole).toBeUndefined();
    expect(styled?.[1].props.accessibilityRole).toBe("link");
  });
});
