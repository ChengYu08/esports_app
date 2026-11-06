import { COURT_COLORS, COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CourtVoteBadge } from "@/features/court/components/CourtVoteBadge";
import { useId, useState } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  side: "plaintiff" | "defendant";
  selected: boolean;
  muted: boolean;
  disabled: boolean;
  count: number;
  proportion: number;
  loading?: boolean;
  onPress: () => void;
};

export function CourtVoteButton({
  side,
  selected,
  muted,
  disabled,
  count,
  proportion,
  loading = false,
  onPress,
}: Props) {
  const [width, setWidth] = useState(0);
  const gradientId = `vote${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const isPlaintiff = side === "plaintiff";
  const label = isPlaintiff ? "支持原告" : "支持被告";
  const background = selected ? (isPlaintiff ? "#E8F4FF" : "#FFE6EB") : muted ? "#F2F5F9" : `url(#${gradientId})`;
  const path = isPlaintiff
    ? `M16 0 H${width - 4} Q${width + 1} 0 ${width - 1} 5 L${width - 12} 28 Q${width - 14} 32 ${width - 18} 32 H16 A16 16 0 0 1 16 0 Z`
    : `M16 0 H${width - 16} A16 16 0 0 1 ${width - 16} 32 H4 Q-1 32 1 27 L12 4 Q14 0 16 0 Z`;
  const color = selected
    ? isPlaintiff ? COURT_COLORS.selectedPlaintiff : COURT_COLORS.selectedDefendant
    : muted ? COURT_COLORS.muted : COURT_COLORS.surface;

  return (
    <Pressable
      accessibilityLabel={`${selected ? "已" : ""}${label} ${count}人`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.button, { flex: proportion }, !isPlaintiff && styles.defendantButton]}
    >
      {width > 0 && (
        <Svg accessible={false} pointerEvents="none" width={width} height={32} style={styles.background}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={isPlaintiff ? "#3CA6FF" : "#FE3666"} />
              <Stop offset="1" stopColor={isPlaintiff ? "#2F8FFF" : "#FF6489"} />
            </LinearGradient>
          </Defs>
          <Path d={path} fill={background} />
        </Svg>
      )}
      <View pointerEvents="none" style={[styles.textRow, isPlaintiff ? styles.plaintiffText : styles.defendantText]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, { color }]}>
          {loading ? "…" : <>{label} <Text style={styles.count}>{count}人</Text></>}
        </Text>
      </View>
      {selected && <CourtVoteBadge side={side} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 32, minWidth: 0, justifyContent: "center" },
  defendantButton: { marginLeft: 4 },
  background: { position: "absolute", top: 0, left: 0 },
  textRow: { alignItems: "center", justifyContent: "center", minWidth: 0 },
  plaintiffText: { paddingLeft: 4, paddingRight: 14 },
  defendantText: { paddingLeft: 14, paddingRight: 4 },
  label: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "500", lineHeight: 18, maxWidth: "100%" },
  count: { fontFamily: COURT_FONT_FAMILY, fontSize: 11, fontWeight: "400", lineHeight: 16 },
});
