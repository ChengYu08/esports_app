import {
  Checkmark16Regular,
  ErrorCircle16Regular,
  Search24Regular,
} from "@fluentui/react-native-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
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

import { SYSTEM_FONT } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";
import type { MultiCompanionCandidate } from "../order.api";

const CONFIRM_GRADIENT = ["#FF2145", "#FF3158"] as const;

type OrderMultiCompanionSheetProps = {
  visible: boolean;
  /** 需选择的参与陪玩人数（配置总人数 - 1） */
  needSelect: number;
  candidates: MultiCompanionCandidate[];
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (userIds: number[]) => void;
};

const DEFAULT_AVATAR = { uri: "" };

/** 一单多陪订单开始服务前的选人弹窗：勾选参与陪玩，选满才能确认开始服务 */
export function OrderMultiCompanionSheet({
  visible,
  needSelect,
  candidates,
  loading = false,
  submitting = false,
  onClose,
  onConfirm,
}: OrderMultiCompanionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastVisible, setLastVisible] = useState(visible);
  // 打开时重置搜索与已选，对齐 Web 弹窗 watch(visible) 行为
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      setKeyword("");
      setSelectedIds([]);
    }
  }

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredCandidates = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) {
      return candidates;
    }
    return candidates.filter((candidate) => {
      const byNickname = (candidate.nickname || "")
        .toLowerCase()
        .includes(trimmed);
      const byId = String(candidate.userId).includes(trimmed);
      return byNickname || byId;
    });
  }, [candidates, keyword]);

  const toggleCandidate = (userId: number) => {
    if (submitting) return;
    if (selectedSet.has(userId)) {
      setSelectedIds((ids) => ids.filter((id) => id !== userId));
      return;
    }
    if (selectedIds.length >= needSelect) return;
    setSelectedIds((ids) => [...ids, userId]);
  };

  const confirmDisabled = submitting || selectedIds.length !== needSelect;

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? () => undefined : onClose}
      keyboardAvoiding
      contentStyle={[styles.sheet, { maxHeight: height * 0.78 }]}
    >
      <View
        style={[styles.body, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>选择共同服务陪玩</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭选人弹窗"
            hitSlop={8}
            disabled={submitting}
            onPress={onClose}
          >
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <View style={styles.tip}>
          <ErrorCircle16Regular
            color="#FFB800"
            width={16}
            height={16}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>
            请提前确认一起服务的陪玩师时间，避免订单开始服务后无法履约。
          </Text>
        </View>
        <View style={styles.searchBox}>
          <Search24Regular color="#B3B3B3" width={20} height={20} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder={`按昵称 / ID 筛选（已选 ${selectedIds.length}/${needSelect}）`}
            placeholderTextColor="#CCCCCC"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!submitting}
            cursorColor="#FE1F4C"
          />
        </View>
        <FlatList
          data={filteredCandidates}
          keyExtractor={(item) => String(item.userId)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading ? "加载中..." : "暂无符合条件的陪玩"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = selectedSet.has(item.userId);
            const disabled = !selected && selectedIds.length >= needSelect;
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled || submitting}
                onPress={() => toggleCandidate(item.userId)}
                style={[
                  styles.row,
                  selected && styles.rowSelected,
                  disabled && styles.rowDisabled,
                ]}
              >
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? (
                    <Checkmark16Regular
                      color="#FFFFFF"
                      width={12}
                      height={12}
                    />
                  ) : null}
                </View>
                <CachedImage
                  source={
                    item.headImage ? { uri: item.headImage } : DEFAULT_AVATAR
                  }
                  contentFit="cover"
                  style={styles.avatar}
                />
                <Text numberOfLines={1} style={styles.name}>
                  {item.nickname || `陪玩${item.userId}`}
                </Text>
                <Text style={styles.userId}>ID {item.userId}</Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.footer}>
          <Text style={styles.footerTip}>
            需选择 {needSelect} 名陪玩一同服务
          </Text>
          <View style={styles.footerButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消选人"
              disabled={submitting}
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="确认并开始服务"
              disabled={confirmDisabled}
              onPress={() => onConfirm(selectedIds)}
              style={[
                styles.confirmButton,
                confirmDisabled && styles.confirmDisabled,
              ]}
            >
              <LinearGradient
                colors={CONFIRM_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>
                  {submitting ? "提交中..." : "确认并开始服务"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  body: { flexShrink: 1, minHeight: 420, paddingHorizontal: 16 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  close: { fontSize: 28, color: "#777", lineHeight: 32 },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  tipIcon: { marginTop: 2 },
  tipText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 20,
    color: "#161616",
  },
  searchBox: {
    height: 36,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  searchInput: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
    color: "#0D0D0F",
    padding: 0,
  },
  list: { marginTop: 12, flexGrow: 1 },
  listContent: { gap: 8, paddingBottom: 8 },
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { fontFamily: SYSTEM_FONT, fontSize: 14, color: "#999" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: { borderColor: "#FE1F4C" },
  rowDisabled: { opacity: 0.5 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#D0D0D0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { borderColor: "#FE1F4C", backgroundColor: "#FE1F4C" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEE" },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    color: "#161616",
  },
  userId: { fontFamily: SYSTEM_FONT, fontSize: 12, color: "#999" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
  },
  footerTip: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#999",
  },
  footerButtons: { flexDirection: "row", gap: 8 },
  cancelButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontFamily: SYSTEM_FONT, fontSize: 14, color: "#666" },
  confirmButton: { opacity: 1 },
  confirmDisabled: { opacity: 0.5 },
  confirmGradient: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
