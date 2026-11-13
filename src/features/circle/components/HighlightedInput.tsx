import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { splitCircleRichText } from "@/features/circle/circle-rich-text";
import type { CircleContentRef } from "@/features/circle/circle-publish.api";

type HighlightedInputProps = TextInputProps & {
  /** 已选择的 @用户 引用；输入中的普通 @草稿也会高亮，但不会成为用户链接。 */
  mentions?: CircleContentRef[] | Record<string, string>;
  /** @xxx / #xxx 高亮样式。 */
  highlightStyle?: StyleProp<TextStyle>;
  /** 布局样式（flex/minHeight/backgroundColor 等），作用在外层容器。 */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * 透明输入框叠加高亮层的轻量方案：底层 Text 渲染 @xxx/#xxx 着色，上层 TextInput
 * 文字透明、仅保留光标与选区，输入/粘贴/删除仍走原生 TextInput，提交逻辑不变。
 *
 * style 只放文字度量（fontSize/lineHeight/fontFamily/padding/textAlignVertical），
 * 两层共用同一份 style 才能保证换行与光标对齐；布局交给 containerStyle。
 */
export const HighlightedInput = forwardRef<TextInput, HighlightedInputProps>(
  function HighlightedInput(
    { value, mentions, highlightStyle, style, containerStyle, multiline, scrollEnabled, ...rest },
    ref,
  ) {
    const segments = splitCircleRichText(value ?? "", mentions, true);
    // 多层输入默认不滚动、随内容增高，保证底层高亮 Text 与输入光标始终对齐。
    const resolvedScroll = scrollEnabled ?? !multiline;
    return (
      <View style={[styles.container, containerStyle]}>
        <Text
          pointerEvents="none"
          numberOfLines={multiline ? undefined : 1}
          style={[style, styles.overlay]}
        >
          {segments.map((segment, index) => {
            if ("userId" in segment || "topic" in segment || "unresolvedMention" in segment) {
              return (
                <Text key={index} style={highlightStyle}>
                  {segment.text}
                </Text>
              );
            }
            return segment.text;
          })}
        </Text>
        <TextInput
          ref={ref}
          value={value}
          multiline={multiline}
          scrollEnabled={resolvedScroll}
          selectionColor="#0D0D0F"
          cursorColor="#0D0D0F"
          style={[style, styles.input]}
          {...rest}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { position: "relative" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  // 文字透明、光标与选区可见：iOS 走 selectionColor，Android 走 cursorColor（均以 prop 传入）。
  input: {
    width: "100%",
    color: "transparent",
    backgroundColor: "transparent",
  },
});
