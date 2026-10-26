import { COURT_COLORS, COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CourtVoteBadge } from "@/features/court/components/CourtVoteBadge";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  side: "plaintiff" | "defendant";
  selected: boolean;
  muted: boolean;
  disabled: boolean;
  count: number;
  loading?: boolean;
  onPress: () => void;
};

const ASSETS = {
  plaintiff: {
    default: require("../../../../assets/court/vote-plaintiff-default.svg"),
    selected: require("../../../../assets/court/vote-plaintiff-selected.svg"),
    muted: require("../../../../assets/court/vote-plaintiff-muted.svg"),
  },
  defendant: {
    default: require("../../../../assets/court/vote-defendant-default.svg"),
    selected: require("../../../../assets/court/vote-defendant-selected.svg"),
    muted: require("../../../../assets/court/vote-defendant-muted.svg"),
  },
};

export function CourtVoteButton({
  side,
  selected,
  muted,
  disabled,
  count,
  loading = false,
  onPress,
}: Props) {
  const isPlaintiff = side === "plaintiff";
  const label = isPlaintiff ? "支持原告" : "支持被告";
  const state = selected ? "selected" : muted ? "muted" : "default";
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
      style={[styles.button, !isPlaintiff && styles.defendantButton]}
    >
      <CachedImage
        accessible={false}
        pointerEvents="none"
        source={ASSETS[side][state]}
        contentFit="fill"
        style={[styles.background, isPlaintiff ? styles.plaintiffBackground : styles.defendantBackground]}
      />
      <View pointerEvents="none" style={styles.textRow}>
        <Text numberOfLines={1} style={[styles.label, { color }]}>
          {loading ? "…" : label}
        </Text>
        {!loading && <Text numberOfLines={1} style={[styles.count, { color }]}>{count}人</Text>}
      </View>
      {selected && <CourtVoteBadge side={side} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, height: 32, minWidth: 0, justifyContent: "center" },
  // Figma overlaps the button frames by 4; the SVG corners form the diagonal gap.
  defendantButton: { marginLeft: -4 },
  background: { position: "absolute", top: 0, bottom: 0 },
  plaintiffBackground: { left: 0, right: "1.52%" },
  defendantBackground: { left: "1.52%", right: 0 },
  textRow: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center", paddingHorizontal: 12 },
  label: { fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "500", lineHeight: 18 },
  count: { fontFamily: COURT_FONT_FAMILY, fontSize: 11, fontWeight: "400", lineHeight: 16 },
});
