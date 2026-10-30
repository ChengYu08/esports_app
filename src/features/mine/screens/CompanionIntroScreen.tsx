import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { companionManagementApi as api } from "../api/companion-management.api";
import { COMPANION_INTRO_MAX_LENGTH } from "../api/companion-management.contract";
import { CompanionDashboardHeader } from "../components/CompanionDashboardHeader";
import { useManagedGame } from "../hooks/use-companion-management";

export default function CompanionIntroScreen() {
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const managed = useManagedGame(gameId);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const initial = managed.detail.data?.skillIntro ?? "";
  const value = draft ?? initial;
  const characterCount = Array.from(value).length;
  const canSave =
    managed.enabled &&
    !!gameId &&
    !!managed.detail.data &&
    !managed.detail.isError &&
    !saving &&
    characterCount <= COMPANION_INTRO_MAX_LENGTH &&
    !!value.trim() &&
    value.trim() !== initial;
  const save = async () => {
    if (!canSave || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      managed.assertCurrentAccount();
      await api.updateIntro(managed.context, managed.token, value.trim());
      await managed.invalidate();
      Keyboard.dismiss();
      showToast("能力介绍已保存");
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败，请重试");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={styles.screen}>
      <CompanionDashboardHeader
        title="编辑简介"
        onSave={() => void save()}
        saveDisabled={!canSave}
        saving={saving}
      />
      {!managed.enabled || !gameId ? (
        <EmptyState message={managed.unavailable || "未指定游戏"} />
      ) : managed.detail.isError ? (
        <ErrorState
          message={managed.detail.error.message}
          onRetry={() => void managed.detail.refetch()}
        />
      ) : managed.detail.isPending ? (
        <LoadingState />
      ) : (
        <Pressable
          onPress={Keyboard.dismiss}
          accessible={false}
          style={styles.content}
        >
          <View style={styles.editor}>
            <TextInput
              accessibilityLabel={`能力介绍，最多${COMPANION_INTRO_MAX_LENGTH}字`}
              autoFocus
              multiline
              editable={!saving}
              maxLength={COMPANION_INTRO_MAX_LENGTH * 2}
              value={value}
              onChangeText={(text) =>
                setDraft(
                  Array.from(text)
                    .slice(0, COMPANION_INTRO_MAX_LENGTH)
                    .join(""),
                )
              }
              placeholder="请输入能力介绍"
              placeholderTextColor="#CCC"
              textAlignVertical="top"
              style={styles.input}
            />
            <Text accessibilityLiveRegion="polite" style={styles.count}>
              <Text
                style={
                  characterCount > COMPANION_INTRO_MAX_LENGTH
                    ? styles.overLimit
                    : styles.currentCount
                }
              >
                {characterCount}
              </Text>
              /{COMPANION_INTRO_MAX_LENGTH}
            </Text>
          </View>
          <Text style={styles.hint}>最多{COMPANION_INTRO_MAX_LENGTH}字</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { flex: 1 },
  editor: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: 8,
    backgroundColor: "#FFF",
  },
  input: {
    minHeight: 104,
    fontSize: 14,
    lineHeight: 22,
    color: "#333",
    padding: 0,
  },
  count: {
    alignSelf: "flex-end",
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  currentCount: { color: "#0A0A0A" },
  overLimit: { color: "#FE1F4C" },
  hint: {
    marginHorizontal: 16,
    marginTop: 8,
    color: "#808080",
    fontSize: 12,
    lineHeight: 18,
  },
});
