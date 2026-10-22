import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type HighlightedTextProps = {
  text: string;
  keyword: string;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function HighlightedText({
  text,
  keyword,
  style,
  highlightStyle,
  numberOfLines = 1,
}: HighlightedTextProps) {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return (
      <Text style={[styles.base, style]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = trimmed.toLowerCase();
  const parts: { value: string; highlight: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerKeyword, cursor);
    if (index < 0) {
      parts.push({ value: text.slice(cursor), highlight: false });
      break;
    }
    if (index > cursor) {
      parts.push({ value: text.slice(cursor, index), highlight: false });
    }
    parts.push({
      value: text.slice(index, index + trimmed.length),
      highlight: true,
    });
    cursor = index + trimmed.length;
  }

  return (
    <Text style={[styles.base, style]} numberOfLines={numberOfLines}>
      {parts.map((part, index) => (
        <Text
          key={`${part.value}-${index}`}
          style={part.highlight ? [styles.highlight, highlightStyle] : undefined}
        >
          {part.value}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#161823",
  },
  highlight: {
    color: "#FE4267",
  },
});
