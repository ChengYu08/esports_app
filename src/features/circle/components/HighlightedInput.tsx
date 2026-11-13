import { forwardRef } from "react";
import {
  Platform,
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
 * iOS 使用透明输入框叠加高亮层；Android 多行输入时两层文字会错位重影，
 * 因此直接显示原生输入文字，@引用与提交逻辑仍由父组件维护。
 *
 * style 只放文字度量（fontSize/lineHeight/fontFamily/padding/textAlignVertical），
 * iOS 两层共用同一份 style；布局交给 containerStyle。
 */
export const HighlightedInput = forwardRef<TextInput, HighlightedInputProps>(
  function HighlightedInput(
    { value, mentions, highlightStyle, style, containerStyle, multiline, scrollEnabled, ...rest },
    ref,
  ) {
    const showHighlightOverlay = Platform.OS !== "android";
    const segments = showHighlightOverlay
      ? splitCircleRichText(value ?? "", mentions, true)
      : [];
    // 输入框不滚动、随内容增高，保持长评论的光标位置与布局稳定。
    const resolvedScroll = scrollEnabled ?? !multiline;
    return (
      <View style={[styles.container, containerStyle]}>
        {showHighlightOverlay ? (
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
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          multiline={multiline}
          scrollEnabled={resolvedScroll}
          selectionColor="#0D0D0F"
          cursorColor="#0D0D0F"
          style={[styles.input, style, showHighlightOverlay && styles.transparentInput]}
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
  input: {
    width: "100%",
    backgroundColor: "transparent",
  },
  transparentInput: { color: "transparent" },
});
