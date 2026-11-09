import { router } from "expo-router";
import { Text, type StyleProp, type TextStyle } from "react-native";

import {
  buildCircleTopicRoute,
  normalizeCircleTopicName,
  splitCircleTopicText,
} from "@/features/circle/circle-topic";

type CircleTopicLinksProps = {
  tags: string[];
  style?: StyleProp<TextStyle>;
  prefix?: string;
  separator?: string;
  onBeforeNavigate?: () => void;
};

type CircleTopicTextProps = {
  content: string;
  style?: StyleProp<TextStyle>;
  topicStyle?: StyleProp<TextStyle>;
  onBeforeNavigate?: () => void;
};

function openCircleTopic(topic: string, onBeforeNavigate?: () => void) {
  const route = buildCircleTopicRoute(topic);
  if (!route) {
    return;
  }
  onBeforeNavigate?.();
  router.push(route);
}

/** 正文及评论中的 #话题 保持行内排版并可单独点击。 */
export function CircleTopicText({ content, style, topicStyle, onBeforeNavigate }: CircleTopicTextProps) {
  return (
    <Text style={style}>
      {splitCircleTopicText(content).map((segment, index) => {
        if (!segment.topic) {
          return segment.text;
        }
        const topic = segment.topic;
        return (
          <Text
            key={index}
            style={topicStyle}
            accessibilityRole="link"
            accessibilityLabel={"查看话题" + topic}
            onPress={() => {
              openCircleTopic(topic, onBeforeNavigate);
            }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

/** 视频信息流与评论弹窗共用同一套话题跳转行为。 */
export function CircleTopicLinks({
  tags,
  style,
  prefix = "",
  separator = " ",
  onBeforeNavigate,
}: CircleTopicLinksProps) {
  const topics = tags.map(normalizeCircleTopicName).filter(Boolean);

  if (topics.length === 0) {
    return null;
  }

  return (
    <Text style={style}>
      {topics.map((topic, index) => (
        <Text
          key={`${topic}-${index}`}
          accessibilityRole="link"
          accessibilityLabel={`查看话题${topic}`}
          onPress={() => {
            openCircleTopic(topic, onBeforeNavigate);
          }}
        >
          {index === 0 ? prefix : separator}#{topic}
        </Text>
      ))}
    </Text>
  );
}
