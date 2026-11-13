import { type ElementType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HighlightedInput } from "./HighlightedInput";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TextHost = "Text" as unknown as ElementType;

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

let renderer: ReactTestRenderer | undefined;

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
  }
  renderer = undefined;
});

describe("HighlightedInput", () => {
  it("发视频和评论输入的 @草稿、已选用户、#话题 使用高亮样式", async () => {
    const highlightStyle = { color: "#1540AD" };
    await act(async () => {
      renderer = create(
        <HighlightedInput
          value="@张三 @李四 #五杀"
          mentions={[{ id: "42", label: "张三", offset: 0, length: 3 }]}
          highlightStyle={highlightStyle}
          onChangeText={() => undefined}
          multiline
        />,
      );
    });

    const highlighted = renderer?.root.findAll(
      (node) => node.type === TextHost && node.props.style === highlightStyle,
    );
    expect(highlighted?.map((node) => node.props.children)).toEqual([
      "@张三",
      "@李四",
      "#五杀",
    ]);
  });
});
