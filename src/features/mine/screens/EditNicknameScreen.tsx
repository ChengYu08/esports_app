import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-root-toast";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { saveAuthSession } from "@/features/auth/session-persistence";
import { validateNickname } from "@/features/mine/utils/nickname-rules";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const NICKNAME_MAX_LENGTH = 18;

export default function EditNicknameScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const route = useLocalSearchParams<{
    nickname?: string | string[];
  }>();
  const routeNickname = Array.isArray(route.nickname)
    ? route.nickname[0]
    : route.nickname;

  const [draft, setDraft] = useState(routeNickname ?? "");
  const [saving, setSaving] = useState(false);

  const charCount = Array.from(draft).length;

  const save = async () => {
    if (!token || !user) {
      return;
    }
    const ruleError = validateNickname(draft);
    if (ruleError) {
      Toast.show(ruleError, { duration: Toast.durations.SHORT });
      return;
    }
    setSaving(true);
    try {
      const profile = await clientAuthApi.updateProfile(token, {
        nickname: draft.trim(),
      });
      const session = {
        accessToken: token,
        user: toAuthUser(profile, user.phone),
      };
      await saveAuthSession(session);
      setSession(session);
      router.back();
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "保存失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft24Regular color="#0A0A0A" width={24} height={24} />
        </Pressable>
        <Text style={styles.headerTitle}>编辑名字</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存"
          disabled={saving}
          onPress={() => void save()}
          style={styles.saveButton}
        >
          <Text style={[styles.saveText, saving && styles.saveTextSaving]}>
            {saving ? "保存中" : "保存"}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.inputSection}>
          <View style={styles.inputCard}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="请填写名字"
              placeholderTextColor="#CCCCCC"
              style={styles.input}
            />
            <View style={styles.counter}>
              <Text
                style={[styles.counterText, charCount > 0 && styles.counterActive]}
              >
                {charCount}
              </Text>
              <Text style={styles.counterText}>/</Text>
              <Text style={styles.counterText}>{NICKNAME_MAX_LENGTH}</Text>
            </View>
          </View>
          <Text style={styles.hintText}>
            {"最多18字，不能使用@<>/等无效字符，30天内可修改4次名字"}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F7F7",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  saveButton: {
    paddingHorizontal: 16,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  saveTextSaving: { opacity: 0.6 },
  inputSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  inputCard: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  input: {
    minHeight: 48,
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    padding: 0,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },
  counterText: {
    color: "#CCCCCC",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  counterActive: { color: "#999999" },
  hintText: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
