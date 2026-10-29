import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import {
  ChevronLeft24Regular,
  ChevronRight16Regular,
  Dismiss24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
import { uploadClientObject } from "@/features/auth/oss-upload";
import { saveAuthSession } from "@/features/auth/session-persistence";
import {
  beginAvatarEdit,
} from "@/features/mine/utils/avatar-edit-session";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const fallbackAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const cameraIcon = require("../../../../assets/mine/figma/edit-camera.svg");

type EditField = "gender" | "birth";

type EditRow = {
  // nickname 行跳转独立页面，不走 BottomSheet 编辑态，故 key 为普通字符串
  key: string;
  label: string;
  value: string;
};

function editTitle(field: EditField | null): string {
  if (field === "gender") return "选择性别";
  if (field === "birth") return "修改年龄";
  return "编辑";
}

function genderText(gender?: number): string {
  if (gender === 1) return "男";
  if (gender === 2) return "女";
  if (gender === 0) return "保密";
  return "-";
}

/** 由出生日期计算周岁；无法解析时返回 null。 */
function calcAge(birth?: string): number | null {
  if (!birth) return null;
  const dateMatch = birth.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!dateMatch) return null;
  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
  );
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [genderSaving, setGenderSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarEditing, setAvatarEditing] = useState(false);

  const age = calcAge(user?.birth);

  const rows: EditRow[] = [
    { key: "nickname", label: "昵称", value: user?.nickname || "-" },
    { key: "signature", label: "个性签名", value: user?.signature || "-" },
    { key: "gender", label: "性别", value: genderText(user?.gender) },
    { key: "birth", label: "年龄", value: age == null ? "-" : String(age) },
  ];

  const applyProfile = async (
    profile: Parameters<typeof toAuthUser>[0],
  ): Promise<void> => {
    const session = {
      accessToken: token as string,
      user: toAuthUser(profile, user?.phone),
    };
    await saveAuthSession(session);
    setSession(session);
  };

  const saveEdit = async () => {
    if (!editing || !token || !user) {
      return;
    }
    const value = draft.trim();
    if (
      editing === "birth" &&
      value &&
      !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)
    ) {
      Toast.show("请输入有效的出生日期，格式为 YYYY-MM-DD", {
        duration: Toast.durations.SHORT,
      });
      return;
    }
    setSaving(true);
    try {
      const profile = await clientAuthApi.updateProfile(token, {
        birth: value || undefined,
      });
      await applyProfile(profile);
      setEditing(null);
      Toast.show("保存成功", { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "保存失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setSaving(false);
    }
  };

  // 性别浮层：点选项立即保存（设计稿交互规则 1：点击选项立即生效，浮层自动收起）
  const saveGenderImmediate = async (gender: number) => {
    if (!token || !user || genderSaving) {
      return;
    }
    setGenderSaving(true);
    try {
      const profile = await clientAuthApi.updateProfile(token, { gender });
      await applyProfile(profile);
      setEditing(null);
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "保存失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setGenderSaving(false);
    }
  };

  const changeAvatar = async () => {
    if (!token || !user || avatarUploading || avatarEditing) {
      return;
    }
    // 进入相册选择 → 裁剪，裁剪结果经会话桥接回传（权限在相册页内处理）
    const editPending = beginAvatarEdit();
    setAvatarEditing(true);
    router.push("/avatar-album");
    try {
      const croppedUri = await editPending;
      if (!croppedUri) return;
      setAvatarUploading(true);
      const fileName = `avatar-${Date.now()}.jpg`;
      const sts = await clientAuthApi.getOssSts(token, "101", [fileName]);
      const objectKey = sts.objectList?.[0];
      if (!objectKey) throw new Error("上传凭证无效");
      const imageUrl = await uploadClientObject(sts, objectKey, {
        uri: croppedUri,
      });
      const profile = await clientAuthApi.updateProfile(token, {
        headImage: imageUrl,
      });
      await applyProfile(profile);
      Toast.show("头像已更新", { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "头像更新失败，请稍后重试",
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setAvatarUploading(false);
      setAvatarEditing(false);
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
        <Text style={styles.headerTitle}>编辑资料</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <CachedImage
            source={user?.headImage ? { uri: user.headImage } : fallbackAvatar}
            style={styles.avatar}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="更换头像"
            disabled={avatarUploading || avatarEditing}
            onPress={() => void changeAvatar()}
            style={[
              styles.changeAvatarCapsule,
              (avatarUploading || avatarEditing) && styles.capsuleDisabled,
            ]}
          >
            <Image
              source={cameraIcon}
              style={styles.cameraIcon}
              contentFit="contain"
            />
            <Text style={styles.changeAvatarText}>
              {avatarUploading ? "上传中" : avatarEditing ? "选择中" : "更换"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.key}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`编辑${row.label}`}
                onPress={() => {
                  // 昵称/个性签名走独立页面（设计稿 253-36947 / 253-36956）
                  if (row.key === "nickname") {
                    router.push({
                      pathname: "/edit-nickname",
                      params: { nickname: user?.nickname ?? "" },
                    });
                    return;
                  }
                  if (row.key === "signature") {
                    router.push({
                      pathname: "/edit-signature",
                      params: { signature: user?.signature ?? "" },
                    });
                    return;
                  }
                  setEditing(row.key as EditField);
                  setDraft(
                    row.key === "gender"
                      ? String(user?.gender ?? 0)
                      : user?.birth || "",
                  );
                }}
                style={styles.row}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                <View style={styles.rowValueWrap}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.rowValue}
                  >
                    {row.value}
                  </Text>
                  <ChevronRight16Regular color="#999999" width={16} height={16} />
                </View>
              </Pressable>
              {index < rows.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomSheet
        keyboardAvoiding
        scrollable
        visible={editing !== null}
        onClose={() => setEditing(null)}
        contentStyle={[styles.modalCard, { paddingBottom: 20 + insets.bottom }]}
      >
        {editing === "gender" ? (
          <>
            {/* 性别浮层：标题+叉号，点选项立即生效（设计稿 253-37294 / 361-40404） */}
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>选择性别</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭"
                hitSlop={12}
                onPress={() => setEditing(null)}
                style={styles.sheetClose}
              >
                <Dismiss24Regular color="#999999" width={20} height={20} />
              </Pressable>
            </View>
            {([
              [1, "男"],
              [2, "女"],
            ] as const).map(([value, label]) => {
              const selected = Number(user?.gender ?? 0) === value;
              return (
                <View key={String(value)}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    disabled={genderSaving}
                    onPress={() => void saveGenderImmediate(value)}
                    style={styles.genderRadioRow}
                  >
                    <Text style={styles.genderRadioText}>{label}</Text>
                    {/* 选中：红圈 + 内部红点，圆圈与红点之间留白色间隙；未选中：灰色圆环（设计稿 Radio/Small-Large-20） */}
                    {selected ? (
                      <View style={styles.radioCircleSelected}>
                        <View style={styles.radioDot} />
                      </View>
                    ) : (
                      <View style={styles.radioCircle} />
                    )}
                  </Pressable>
                  <View style={styles.genderDivider} />
                </View>
              );
            })}
          </>
        ) : (
          <View>
            <Text style={styles.modalTitle}>{editTitle(editing)}</Text>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              maxLength={10}
              placeholder={
                editing === "birth" ? "请输入出生日期，如 2000-01-01" : "请输入"
              }
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditing(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void saveEdit()}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmText}>
                  {saving ? "保存中" : "保存"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
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
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  headerSpace: { width: 44 },
  avatarSection: {
    height: 142,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFF",
  },
  changeAvatarCapsule: {
    // 与头像底部重叠 12px（设计稿 Frame 间距 -12）
    marginTop: -12,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cameraIcon: { width: 16, height: 16 },
  capsuleDisabled: { opacity: 0.6 },
  changeAvatarText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  card: {
    marginHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  row: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  rowLabel: {
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  rowValueWrap: {
    flex: 1,
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  rowValue: {
    flexShrink: 1,
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 16,
  },
  modalCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  genderOptions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  genderOption: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
  },
  genderOptionActive: {
    borderColor: "#FF1F4C",
    backgroundColor: "#FFF0F3",
  },
  genderOptionText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  input: {
    marginTop: 16,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#555555",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FF1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    marginBottom: 8,
  },
  sheetTitle: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  sheetClose: {
    position: "absolute",
    right: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  genderRadioRow: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  genderRadioText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CCCCCC",
  },
  // 选中：外圈 Ø16（环宽 1.5 红）+ 中心 Ø8 红点，间隙约 2.5（设计稿几何：16.25/8.07/1.5）
  radioCircleSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#E01B28",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E01B28",
  },
  genderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
  },
});
