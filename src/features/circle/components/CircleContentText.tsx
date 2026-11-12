import { router } from "expo-router";
import { Text, type StyleProp, type TextStyle } from "react-native";

import type { CircleContentRef } from "@/features/circle/circle-publish.api";
import { splitCircleRichText } from "@/features/circle/circle-rich-text";
import {
  buildCircleTopicRoute,
  normalizeCircleTopicName,
} from "@/features/circle/circle-topic";

type CircleContentTextProps = {
  content: string;
  style?: StyleProp<TextStyle>;
  /** #话题 与 @用户 的统一样式。 */
  linkStyle?: StyleProp<TextStyle>;
  /** @用户 独立样式，缺省回退到 linkStyle。 */
  mentionStyle?: StyleProp<TextStyle>;
  /** @用户 引用；RefVO 数组（带位置）优先，字典（id→昵称）回退推导。 */
  mentions?: CircleContentRef[] | Record<string, string> | null;
  /** 正文外的附加话题，仍与正文保持同行。 */
  tags?: string[];
  /** 跳转前回调（关闭弹窗/收起键盘）。 */
  onBeforeNavigate?: () => void;
};

/** 正文及评论中的 #话题、@用户 保持行内排版并可单独点击。 */
export function CircleContentText({
  content,
  style,
  linkStyle,
  mentionStyle,
  mentions,
  tags,
  onBeforeNavigate,
}: CircleContentTextProps) {
  const openTopic = (topic: string) => {
    const route = buildCircleTopicRoute(topic);
    if (!route) {
      return;
    }
    onBeforeNavigate?.();
    router.push(route);
  };
  const extraTopics = tags?.map(normalizeCircleTopicName).filter(Boolean) ?? [];

  return (
    <Text style={style}>
      {splitCircleRichText(content, mentions ?? undefined).map((segment, index) => {
        if ("userId" in segment) {
          return (
            <Text
              key={index}
              style={mentionStyle ?? linkStyle}
              accessibilityRole="link"
              accessibilityLabel={`查看${segment.text}的主页`}
              onPress={() => {
                onBeforeNavigate?.();
                router.push({ pathname: "/profile", params: { userId: segment.userId } });
              }}
            >
              {segment.text}
            </Text>
          );
        }
        if ("topic" in segment) {
          return (
            <Text
              key={index}
              style={linkStyle}
              accessibilityRole="link"
              accessibilityLabel={"查看话题" + segment.topic}
              onPress={() => {
                openTopic(segment.topic);
              }}
            >
              {segment.text}
            </Text>
          );
        }
        return segment.text;
      })}
      {extraTopics.map((topic, index) => (
        <Text
          key={`tag-${topic}-${index}`}
          style={linkStyle}
          accessibilityRole="link"
          accessibilityLabel={`查看话题${topic}`}
          onPress={() => {
            openTopic(topic);
          }}
        >
          {` #${topic}`}
        </Text>
      ))}
    </Text>
  );
}
