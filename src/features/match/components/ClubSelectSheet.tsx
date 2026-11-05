import { Dismiss16Regular, Search24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MatchClub } from "@/features/match/api/match.types";
import { HighlightedText } from "@/features/match/components/HighlightedText";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const CONFIRM_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

type ClubSelectSheetProps = {
  visible: boolean;
  clubs: MatchClub[];
  selectedClubId: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (club: MatchClub) => void;
};

export function ClubSelectSheet({
  visible,
  clubs,
  selectedClubId,
  loading = false,
  onClose,
  onConfirm,
}: ClubSelectSheetProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [keyword, setKeyword] = useState("");
  const [tempSelectedId, setTempSelectedId] = useState(selectedClubId);
  const cardWidth = (width - 32 - 24) / 3;

  useEffect(() => {
    if (!visible) return;
    setKeyword("");
    setTempSelectedId(selectedClubId);
  }, [selectedClubId, visible]);

  const filteredClubs = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return clubs;
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(trimmed) ||
        club.id.toLowerCase().includes(trimmed),
    );
  }, [clubs, keyword]);

  const handleConfirm = () => {
    const club = clubs.find((item) => item.id === tempSelectedId);
    if (!club) return;
    onConfirm(club);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAvoiding
      backdropStyle={styles.backdrop}
      contentStyle={[styles.sheet, { maxHeight: height * 0.78 }]}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>选择俱乐部</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Dismiss16Regular color="rgba(0, 0, 0, 0.2)" width={20} height={20} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search24Regular color="#B3B3B3" width={20} height={20} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder="搜索俱乐部名称"
              placeholderTextColor="#CCCCCC"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              cursorColor="#FE1F4C"
            />
            {keyword.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空搜索"
                hitSlop={8}
                onPress={() => setKeyword("")}
              >
                <View style={styles.clearIcon}>
                  <Dismiss16Regular color="rgba(0, 0, 0, 0.2)" width={11} height={11} />
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          numColumns={3}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading ? "加载中…" : "暂无匹配的俱乐部"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = item.id === tempSelectedId;
            const initial = Array.from(item.name.trim())[0] ?? "?";
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setTempSelectedId(item.id)}
                style={[
                  styles.card,
                  { width: cardWidth },
                  selected && styles.cardSelected,
                ]}
              >
                {item.logoUrl ? (
                  <Image
                    source={{ uri: item.logoUrl }}
                    style={styles.cover}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverInitial}>{initial}</Text>
                  </View>
                )}
                <HighlightedText
                  text={item.name}
                  keyword={keyword}
                  style={styles.cardName}
                  numberOfLines={1}
                />
              </Pressable>
            );
          }}
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="确定"
            onPress={handleConfirm}
            style={({ pressed }) => [styles.confirmWrap, pressed && styles.pressed]}
          >
            <MatchLinearGradient
              colors={CONFIRM_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirm}
            >
              <Text style={styles.confirmText}>确定</Text>
            </MatchLinearGradient>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  body: {
    flexShrink: 1,
    minHeight: 420,
  },
  header: {
    height: 56,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  closeButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#0D0D0F",
    padding: 0,
  },
  clearIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  card: {
    height: 91,
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardSelected: {
    backgroundColor: "#FFF5F7",
    borderColor: "#FE1F4C",
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 4,
    overflow: "hidden",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E9EB",
  },
  coverInitial: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    color: "#6B6E75",
  },
  cardName: {
    width: "100%",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    color: "#0D0D0F",
    textAlign: "center",
  },
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999999",
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  confirmWrap: {
    width: "100%",
  },
  confirm: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
  },
});
