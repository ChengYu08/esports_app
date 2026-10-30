import { memo } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";

const maleIcon = require("../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../assets/mine/figma/mine-female.svg");
const diamondIcon = require("../../../assets/home/club-detail/icon-diamond.svg");
const emptyAvatar = require("../../../assets/mine/figma/mine-avatar.png");
const statusPlayingIcon = require("../../../assets/home/club-detail/status-playing.svg");
const statusIdleIcon = require("../../../assets/home/club-detail/status-idle.svg");

export type CompanionCardProps = {
  nickname: string;
  avatar: string;
  sex: number;
  age: number | null;
  tagName: string;
  tagColor: string;
  gameName?: string;
  gameIconUrl?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  signature?: string;
  onlineStatus: number;
  gameStatus: number;
  price: number;
  orderCount: number;
  voiceUrl: string | null;
  voiceDurationSeconds: number | null;
  voicePlayingUrl: string | null;
  onToggleVoice: (voiceUrl: string) => void;
  onPress: () => void;
};

/** 标签兜底配色：后台未下发移动端背景色时使用（对齐设计稿 Tag/陪玩 组件色板 node 1126-176457） */
function levelTagColor(tagName: string) {
  // 注意顺序：魔王pro 要先于 魔王 判断
  if (tagName.includes("魔王pro")) return "#BB3EFA";
  if (tagName.includes("颜值")) return "#3DA5FF";
  if (tagName.includes("人气")) return "#13AEBD";
  if (tagName.includes("大神")) return "#8BAD23";
  if (tagName.includes("魔王")) return "#FF42A1";
  if (tagName.includes("顶尖")) return "#FE4267";
  if (tagName.includes("明星")) return "#7D47FC";
  if (tagName.includes("金")) return "#D19643";
  if (tagName.includes("娱乐")) return "#477BFE";
  return "#C0C4CC";
}

/** 陪玩师卡片（大神列表 / 俱乐部主页共用）：纯 UI 组件，跳转与语音播放由父级注入 */
export const CompanionCard = memo(function CompanionCard({
  nickname,
  avatar,
  sex,
  age,
  tagName,
  tagColor,
  gameName,
  gameIconUrl,
  modeName,
  levelName,
  serviceName,
  signature,
  onlineStatus,
  gameStatus,
  price,
  orderCount,
  voiceUrl,
  voiceDurationSeconds,
  voicePlayingUrl,
  onToggleVoice,
  onPress,
}: CompanionCardProps) {
  const online = onlineStatus === 1;
  const busy = gameStatus === 1;
  // 第三行文案：模式 / 等级 / 服务 斜杠分割纯文本，接口未配置时兜底个性签名
  const introLine =
    [modeName, levelName, serviceName].filter(Boolean).join(" / ") ||
    signature ||
    "保持一点神秘感...";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardLeft}>
        <Image
          source={avatar ? { uri: avatar } : emptyAvatar}
          style={styles.avatar}
          contentFit="cover"
        />
        {voiceUrl ? (
          <View style={styles.voicePill}>
            <VoicePlayButton
              url={voiceUrl}
              duration={voiceDurationSeconds}
              tone="light"
              playingUrl={voicePlayingUrl}
              onToggleVoice={onToggleVoice}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <View style={styles.cardContent}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {nickname}
            </Text>
            {sex === 1 || sex === 2 ? (
              <Image
                source={sex === 1 ? maleIcon : femaleIcon}
                style={[styles.genderIcon, sex === 1 ? styles.genderMale : styles.genderFemale]}
              />
            ) : null}
            {age != null && (sex === 1 || sex === 2) ? (
              <Text style={[styles.ageText, sex === 1 ? styles.ageTextMale : styles.ageTextFemale]}>
                {age}
              </Text>
            ) : null}
            {online ? (
              <View style={[styles.statusTag, busy ? styles.statusBusyBg : styles.statusIdleBg]}>
                <Image
                  source={busy ? statusPlayingIcon : statusIdleIcon}
                  style={[styles.statusTagIcon, busy ? styles.statusIconBusy : styles.statusIconIdle]}
                />
                <Text style={[styles.statusTagText, busy ? styles.statusBusyText : styles.statusIdleText]}>
                  {busy ? "游戏中" : "空闲中"}
                </Text>
              </View>
            ) : null}
          </View>
          {gameName ? (
            <View style={styles.gameTag}>
              {gameIconUrl ? (
                <Image source={{ uri: gameIconUrl }} style={styles.gameTagIcon} contentFit="cover" />
              ) : null}
              <Text style={styles.gameTagText}>{gameName}</Text>
            </View>
          ) : null}
          <View style={styles.introRow}>
            {tagName ? (
              <View
                style={[styles.levelTag, { backgroundColor: tagColor || levelTagColor(tagName) }]}
              >
                <Text style={styles.levelTagText}>{tagName}</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={styles.introText}>
              {introLine}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{price}</Text>
            <Image source={diamondIcon} style={styles.diamond} />
          </View>
          <View style={styles.salesWrap}>
            <Text style={styles.salesLabel}>销量</Text>
            <Text style={styles.salesValue}>{orderCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  cardPressed: { backgroundColor: "#F7F7F7" },
  cardLeft: { width: 100, height: 100 },
  avatar: { width: 100, height: 100, borderRadius: 8 },
  voicePill: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFF",
    borderRadius: 99,
    paddingTop: 3,
    paddingRight: 2,
    paddingBottom: 3,
    paddingLeft: 2,
  },
  cardRight: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardContent: { gap: 4 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
  },
  genderIcon: { width: 12, height: 12 },
  genderMale: { tintColor: "#3DA5FF" },
  genderFemale: { tintColor: "#FF42A1" },
  ageText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  ageTextMale: { color: "#3DA5FF" },
  ageTextFemale: { color: "#FF42A1" },
  statusTag: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 3,
    // 设计稿 L2 Tag：高 16（文字 14 + 上下 1）、左右 3
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  statusBusyBg: { backgroundColor: "#FFF4EB" },
  statusIdleBg: { backgroundColor: "#E6FAEF" },
  statusTagIcon: { width: 10, height: 10 },
  statusIconBusy: { tintColor: "#F5821D" },
  statusIconIdle: { tintColor: "#14A357" },
  statusTagText: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
  statusBusyText: { color: "#F5821D" },
  statusIdleText: { color: "#14A357" },
  gameTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF4EB",
    borderRadius: 3,
    // 设计稿 tag/game：高 16（文字 14 + 上下 1）、右 4
    paddingRight: 4,
    paddingVertical: 1,
  },
  gameTagIcon: { width: 16, height: 16, borderRadius: 3 },
  gameTagText: { color: "#B25C15", fontSize: 10, lineHeight: 14, fontWeight: "500" },
  introRow: {
    flexDirection: "row",
    // 标签与右侧文案垂直居中对齐，间距与卡内其他行一致为 4
    alignItems: "center",
    gap: 4,
  },
  levelTag: {
    // 设计稿 Tag/陪玩：水平 padding 2、圆角 2，高度较 14 增加 1 单位
    borderRadius: 2,
    paddingHorizontal: 2,
    height: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  // 关闭 Android 字体额外 padding，保证 10/13 文字在 15 高标签内垂直居中
  levelTagText: {
    color: "#FFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  introText: {
    flex: 1,
    color: "#979799",
    fontSize: 11,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  priceWrap: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  price: {
    color: "#FE1F4C",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  diamond: { width: 15, height: 15, marginBottom: 3 },
  salesWrap: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 },
  salesLabel: { color: "#979799", fontSize: 12, lineHeight: 18 },
  salesValue: { color: "#7F7F80", fontSize: 12, lineHeight: 18 },
});
