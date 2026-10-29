import { memo, useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { parseMarkdown, type MarkdownInline } from "../markdown";

const headingFontSizes: Record<number, number> = { 1: 18, 2: 17, 3: 16, 4: 15, 5: 15, 6: 15 };

function InlineRuns({ inlines, style }: { inlines: MarkdownInline[]; style?: StyleProp<TextStyle> }) {
  if (inlines.length === 0) return null;
  return (
    <Text style={style}>
      {inlines.map((inline, index) => (
        <Text
          key={`${index}-${inline.text}`}
          style={[
            style,
            inline.bold && styles.bold,
            inline.italic && styles.italic,
            inline.strike && styles.strike,
            inline.code && styles.code,
          ]}
        >
          {inline.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * 平台通知等自定义消息的 markdown 气泡，对齐 Web 端 md-bubble 的排版
 * （标题加粗、段落间距 4、列表缩进），纯文本内容退化为普通气泡样式。
 */
export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  if (blocks.length === 0) return null;
  return (
    <View>
      {blocks.map((block, index) => {
        const gapStyle = index > 0 ? styles.blockGap : undefined;
        if (block.type === "heading") {
          return (
            <InlineRuns
              key={index}
              inlines={block.inlines}
              style={[
                styles.heading,
                { fontSize: headingFontSizes[block.level] || 15, lineHeight: (headingFontSizes[block.level] || 15) + 8 },
                gapStyle,
              ]}
            />
          );
        }
        if (block.type === "list") {
          return (
            <View key={index} style={[styles.list, gapStyle]}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.listItem}>
                  <Text style={styles.listMarker}>{item.marker}</Text>
                  <View style={styles.listItemText}>
                    <InlineRuns inlines={item.inlines} style={styles.text} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        return <InlineRuns key={index} inlines={block.inlines} style={[styles.text, gapStyle]} />;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  text: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  blockGap: { marginTop: 4 },
  heading: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontWeight: "700",
  },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  strike: { textDecorationLine: "line-through" },
  code: {
    backgroundColor: "#F2F2F2",
    color: "#C7254E",
  },
  list: { alignSelf: "flex-start" },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listMarker: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    marginRight: 6,
  },
  listItemText: {
    flex: 1,
    minWidth: 0,
  },
});
