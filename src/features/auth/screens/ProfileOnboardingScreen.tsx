import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { useOnboardingStore } from "@/features/auth/onboarding-store";
import { uploadClientObject } from "@/features/auth/oss-upload";
import { saveAuthSession } from "@/features/auth/session-persistence";
import { beginMediaPick } from "@/shared/media-picker/media-picker-session";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const avatarPlaceholder = require("../../../../assets/onboarding/avatar-panda.svg");
const genderMaleIcon = require("../../../../assets/onboarding/gender-male.svg");
const genderFemaleIcon = require("../../../../assets/onboarding/gender-female.svg");
const cameraIcon = require("../../../../assets/onboarding/icon-camera.svg");

const NICKNAME_MAX_LENGTH = 18;

// Figma 设计稿颜色
const COLOR_BRAND = "#FE1F4C";
const COLOR_ERROR = "#FE4267";
const COLOR_TEXT = "#333333";
const COLOR_PLACEHOLDER = "#CCCCCC";
const COLOR_INPUT_BG = "#F7F7F7";
const COLOR_BORDER = "#EBEBEB";
const COLOR_GENDER_SELECTED_BG = "#EBF3FF";
const COLOR_GENDER_SELECTED_BORDER = "#70A9FF";
const COLOR_TITLE_UNDERLINE = "#FFC2C6";

type Gender = 0 | 1;

export default function ProfileOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const markSkipped = useOnboardingStore((state) => state.markSkipped);
  const markCompleted = useOnboardingStore((state) => state.markCompleted);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [nicknameError, setNicknameError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedNickname = useMemo(() => nickname.trim(), [nickname]);
  const canSubmit =
    trimmedNickname.length > 0 && gender !== null && !avatarUploading && !submitting;

  const handlePickAvatar = async () => {
    if (!token || avatarUploading) return;
    // 进入相册选择 → 裁剪，裁剪结果经会话桥接回传（权限在相册页内处理）
    const pickPending = beginMediaPick();
    router.push({ pathname: "/media-picker", params: { crop: "1", max: "1" } });
    const croppedUri = (await pickPending)?.[0];
    if (!croppedUri) return;
    setAvatarUploading(true);
    try {
      const fileName = `avatar-${Date.now()}.jpg`;
      let imageUrl = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const sts = await clientAuthApi.getOssSts(token, "101", [fileName]);
          const objectKey = sts.objectList?.[0];
          if (!objectKey) throw new Error("上传凭证无效");
          imageUrl = await uploadClientObject(sts, objectKey, { uri: croppedUri });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!imageUrl) {
        throw new Error(
          lastError instanceof Error ? lastError.message : "上传失败，请重试",
        );
      }
      setAvatarUri(imageUrl);
    } catch (error) {
      Toast.show(
        `上传头像失败，${error instanceof Error ? error.message : "请稍后重试"}`,
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const validate = (): boolean => {
    if (!trimmedNickname) {
      setNicknameError("起个好听的名字吧");
      return false;
    }
    setNicknameError("");
    return true;
  };

  const handleSkip = async () => {
    if (user?.id) await markSkipped(user.id);
    router.replace("/");
  };

  const handleSubmit = async () => {
    if (!canSubmit || !token || !user) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data: { nickname: string; gender: number; headImage?: string } = {
        nickname: trimmedNickname,
        gender: gender!,
      };
      if (avatarUri) {
        data.headImage = avatarUri;
      }
      const profile = await clientAuthApi.updateProfile(token, data);
      const session = {
        accessToken: token,
        user: toAuthUser(profile, user.phone),
      };
      await saveAuthSession(session);
      setSession(session);
      await markCompleted(String(profile.id));
      router.replace("/");
    } catch (error) {
      Toast.show(
        `保存失败，${error instanceof Error ? error.message : "请稍后重试"}`,
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    if (nicknameError) setNicknameError("");
  };

  return (
    <View style={styles.screen}>
      {/* 顶部渐变背景：粉 → 浅蓝 */}
      <LinearGradient
        colors={["#FFEBEC", "#EBFDFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGradient}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 状态栏占位 */}
          <View style={{ height: insets.top + 44 }} />

          {/* 内容区 */}
          <View style={styles.content}>
            {/* 标题 */}
            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>完善资料</Text>
                <View style={styles.titleUnderline} />
              </View>
              <Text style={styles.subtitle}>让大家更好的认识你～</Text>
            </View>

            {/* 头像 */}
            <Pressable style={styles.avatarWrap} onPress={handlePickAvatar}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Image
                    source={avatarPlaceholder}
                    style={styles.avatarImage}
                  />
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Image source={cameraIcon} style={styles.cameraIconImage} />
              </View>
              {avatarUploading ? (
                <View style={styles.avatarLoadingOverlay}>
                  <Text style={styles.avatarLoadingText}>上传中…</Text>
                </View>
              ) : null}
            </Pressable>

            {/* 昵称 */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>昵称</Text>
              <View
                style={[
                  styles.inputBox,
                  nicknameError ? styles.inputBoxError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={handleNicknameChange}
                  placeholder="起个好听的名字吧"
                  placeholderTextColor={COLOR_PLACEHOLDER}
                  maxLength={NICKNAME_MAX_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!submitting}
                  selectionColor={COLOR_BRAND}
                  cursorColor={COLOR_BRAND}
                />
                <View style={styles.counterBox}>
                  <Text style={styles.counterText}>
                    {nickname.length}/{NICKNAME_MAX_LENGTH}
                  </Text>
                </View>
              </View>
              {nicknameError ? (
                <Text style={styles.errorText}>{nicknameError}</Text>
              ) : null}
            </View>

            {/* 性别 */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>性别</Text>
              <View style={styles.genderRow}>
                <Pressable
                  style={[
                    styles.genderOption,
                    gender === 1 ? styles.genderOptionSelected : null,
                  ]}
                  onPress={() => setGender(1)}
                >
                  <Image source={genderMaleIcon} style={styles.genderIcon} />
                  <Text style={styles.genderLabel}>男</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.genderOption,
                    gender === 0 ? styles.genderOptionSelected : null,
                  ]}
                  onPress={() => setGender(0)}
                >
                  <Image source={genderFemaleIcon} style={styles.genderIcon} />
                  <Text style={styles.genderLabel}>女</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部按钮 */}
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>跳过</Text>
        </Pressable>
        <Pressable
          style={[
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>下一步</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 100,
  },
  titleBlock: {
    marginBottom: 32,
  },
  titleRow: {
    position: "relative",
    alignSelf: "flex-start",
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: "600",
    color: COLOR_TEXT,
    lineHeight: 30,
  },
  titleUnderline: {
    position: "absolute",
    bottom: -3,
    left: 2,
    width: 58,
    height: 6,
    backgroundColor: COLOR_TITLE_UNDERLINE,
    borderRadius: 3,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLOR_TEXT,
    lineHeight: 22,
    letterSpacing: 0.7,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    marginBottom: 32,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    margin: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconImage: {
    width: 18,
    height: 18,
  },
  avatarLoadingOverlay: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLoadingText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: SYSTEM_FONT,
  },
  fieldBlock: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLOR_TEXT,
    lineHeight: 22,
    marginBottom: 12,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    backgroundColor: COLOR_INPUT_BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputBoxError: {
    borderColor: COLOR_ERROR,
  },
  input: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLOR_TEXT,
    lineHeight: 22,
    paddingVertical: 0,
  },
  counterBox: {
    marginLeft: 16,
  },
  counterText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLOR_PLACEHOLDER,
    lineHeight: 22,
  },
  errorText: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "400",
    color: COLOR_ERROR,
    lineHeight: 18,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  genderOption: {
    width: 149,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: COLOR_INPUT_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  genderOptionSelected: {
    backgroundColor: COLOR_GENDER_SELECTED_BG,
    borderColor: COLOR_GENDER_SELECTED_BORDER,
  },
  genderIcon: {
    width: 24,
    height: 24,
  },
  genderLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "600",
    color: COLOR_TEXT,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#fff",
  },
  skipButton: {
    width: 120,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLOR_TEXT,
    lineHeight: 22,
  },
  submitButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLOR_BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 22,
  },
});
