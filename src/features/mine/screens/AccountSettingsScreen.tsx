import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clearAuthSession, saveAuthSession } from "@/features/auth/session-persistence";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { storage } from "@/core/storage/storage";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");
const avatar = require("../../../../assets/mine/figma/mine-avatar.png");
const SMS_NOTIFY_KEY_PREFIX = "pzdj:sms-notify:";

type EditField = "nickname" | "gender" | "birth" | "signature";

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [realNameVisible, setRealNameVisible] = useState(false);
  const [realName, setRealName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [realNameSaving, setRealNameSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (user?.id) void storage.get(`${SMS_NOTIFY_KEY_PREFIX}${user.id}`).then((value) => {
      if (active) setSmsEnabled(value !== "0");
    });
    return () => { active = false; };
  }, [user?.id]);

  const age = useMemo(() => calculateAge(user?.birth), [user?.birth]);
  const maskedPhone = maskPhone(user?.phone);
  const realNameText = user?.isRealName === 1 ? user.realName || "已认证" : "未认证";

  const updateSms = (value: boolean) => {
    setSmsEnabled(value);
    if (user?.id) {
      void storage.set(`${SMS_NOTIFY_KEY_PREFIX}${user.id}`, value ? "1" : "0");
    }
  };

  const openEdit = (field: EditField) => {
    setEditing(field);
    setDraft(field === "nickname" ? user?.nickname || "" : field === "gender" ? String(user?.gender ?? 0) : field === "birth" ? user?.birth || "" : user?.signature || "");
  };

  const saveEdit = async () => {
    if (!editing || !token || !user) return;
    const value = editing === "nickname" || editing === "signature" ? draft.trim() : draft;
    if (editing === "nickname" && !value) {
      Alert.alert("提示", "昵称不能为空");
      return;
    }
    if (editing === "birth" && value && !isValidBirth(value)) {
      Alert.alert("提示", "请输入有效的出生日期，格式为 YYYY-MM-DD");
      return;
    }
    setSaving(true);
    try {
      const data = editing === "nickname" ? { nickname: value } : editing === "signature" ? { signature: draft } : editing === "gender" ? { gender: Number(draft) } : { birth: draft || undefined };
      const profile = await clientAuthApi.updateProfile(token, data);
      const session = { accessToken: token, user: toAuthUser(profile, user.phone) };
      await saveAuthSession(session);
      setSession(session);
      setEditing(null);
    } catch (error) {
      Alert.alert("保存失败", error instanceof Error ? error.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const submitRealName = async () => {
    if (!token || !realName.trim() || !isValidIdCard(idCard.trim())) {
      Alert.alert("提示", "请输入姓名和正确的18位身份证号");
      return;
    }
    setRealNameSaving(true);
    try {
      await clientAuthApi.realNameVerify(token, { name: realName.trim(), num: idCard.trim() });
      const profile = await clientAuthApi.fetchCurrentUser(token);
      const session = { accessToken: token, user: toAuthUser(profile, user?.phone) };
      await saveAuthSession(session);
      setSession(session);
      setRealNameVisible(false);
      setRealName("");
      setIdCard("");
      Alert.alert("认证成功");
    } catch (error) {
      Alert.alert("认证失败", error instanceof Error ? error.message : "请稍后重试");
    } finally {
      setRealNameSaving(false);
    }
  };

  const logout = () => {
    Alert.alert("退出登录", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: () => void (async () => {
          if (token) void clientAuthApi.logout(token).catch(() => undefined);
          try { await clearAuthSession(); } catch { /* Keep the UI signed out. */ }
          clearSession();
          router.replace("/(tabs)/mine");
        })(),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>账号设置</Text>
        <View style={styles.headerSpace} />
      </View>
      {!user ? <View style={styles.signedOut}><Text style={styles.signedOutText}>登录后可管理账号设置</Text><Pressable onPress={() => router.push("/login")} style={styles.confirmButton}><Text style={styles.confirmText}>登录 / 注册</Text></Pressable></View> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Section title="头像设置">
          <SettingRow label="头像" onPress={() => Alert.alert("头像设置", "移动端头像上传功能暂未开放")}>
            <Image source={user?.headImage ? { uri: user.headImage } : avatar} style={styles.avatar} />
          </SettingRow>
        </Section>
        <Section title="个人信息">
          <SettingRow label="昵称" value={user?.nickname || "-"} onPress={() => openEdit("nickname")} />
          <SettingRow label="ID" value={user?.id || "-"} />
          <SettingRow label="性别" value={genderText(user?.gender)} onPress={() => openEdit("gender")} />
          <SettingRow label="年龄" value={age == null ? "-" : `${age}岁`} onPress={() => openEdit("birth")} />
          <SettingRow label="个性签名" value={user?.signature || "-"} onPress={() => openEdit("signature")} />
        </Section>
        <Section title="账号安全">
          <SettingRow label="手机号" value={maskedPhone} />
          <SettingRow label="实名认证" value={realNameText} valueMuted={user?.isRealName !== 1} onPress={user?.isRealName === 1 ? undefined : () => setRealNameVisible(true)} />
        </Section>
        <Section title="信息通知">
          <SettingRow label="开启短信通知"><Switch value={smsEnabled} onValueChange={updateSms} trackColor={{ false: "#D9D9D9", true: "#FF1F4C" }} thumbColor="#FFFFFF" /></SettingRow>
        </Section>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}><Text style={styles.logoutText}>退出登录</Text></Pressable>
      </ScrollView>}

      <Modal transparent visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editTitle(editing)}</Text>
            {editing === "gender" ? <View style={styles.genderOptions}>{[[1, "男"], [2, "女"], [0, "保密"]].map(([value, label]) => <Pressable key={String(value)} onPress={() => setDraft(String(value))} style={[styles.genderOption, draft === String(value) && styles.genderOptionActive]}><Text style={styles.genderOptionText}>{label}</Text></Pressable>)}</View> : <TextInput autoFocus value={draft} onChangeText={setDraft} maxLength={editing === "signature" ? 60 : editing === "nickname" ? 20 : 10} placeholder={editing === "birth" ? "请输入出生日期，如 2000-01-01" : "请输入"} style={styles.input} />}
            <View style={styles.modalActions}><Pressable onPress={() => setEditing(null)} style={styles.cancelButton}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={saving} onPress={() => void saveEdit()} style={styles.confirmButton}><Text style={styles.confirmText}>{saving ? "保存中" : "保存"}</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal transparent visible={realNameVisible} animationType="slide" onRequestClose={() => setRealNameVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>实名认证</Text><Text style={styles.notice}>根据国家规定，本平台禁止未成年人交易</Text><TextInput value={realName} onChangeText={setRealName} placeholder="请输入真实姓名" style={styles.input} /><TextInput value={idCard} onChangeText={setIdCard} placeholder="请输入身份证号" maxLength={18} style={styles.input} autoCapitalize="characters" /><View style={styles.modalActions}><Pressable onPress={() => setRealNameVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={realNameSaving} onPress={() => void submitRealName()} style={styles.confirmButton}><Text style={styles.confirmText}>{realNameSaving ? "提交中" : "提交认证"}</Text></Pressable></View></View></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.card}>{children}</View></View>; }
function SettingRow({ label, value, valueMuted, onPress, children }: { label: string; value?: string; valueMuted?: boolean; onPress?: () => void; children?: React.ReactNode }) { return <Pressable disabled={!onPress} onPress={onPress} style={styles.row}><Text style={styles.label}>{label}</Text><View style={styles.rowValue}>{children || <Text style={[styles.value, valueMuted && styles.valueMuted]}>{value}</Text>}{onPress ? <Image source={arrowIcon} style={styles.arrow} /> : null}</View></Pressable>; }
function genderText(value?: number) { return value === 1 ? "男" : value === 2 ? "女" : "保密"; }
function maskPhone(phone?: string) { if (!phone) return "未绑定"; if (phone.includes("*")) return phone; return phone.length >= 7 ? `${phone.slice(0, 3)}*****${phone.slice(-4)}` : phone; }
function isValidBirth(birth: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return false; const [year, month, day] = birth.split("-").map(Number); const date = new Date(year, month - 1, day); return year >= 1900 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= new Date(); }
function calculateAge(birth?: string) { if (!birth || !isValidBirth(birth)) return null; const date = new Date(birth); const now = new Date(); let value = now.getFullYear() - date.getFullYear(); if (now < new Date(now.getFullYear(), date.getMonth(), date.getDate())) value -= 1; return value; }
function isValidIdCard(value: string) { if (!/^\d{17}[\dXx]$/.test(value)) return false; const birth = `${value.slice(6, 10)}-${value.slice(10, 12)}-${value.slice(12, 14)}`; return isValidBirth(birth); }
function editTitle(field: EditField | null) { return field === "nickname" ? "编辑昵称" : field === "gender" ? "选择性别" : field === "birth" ? "编辑年龄" : "编辑个性签名"; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F7F7" }, header: { height: 44, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }, backButton: { width: 28, height: 28, justifyContent: "center" }, backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" }, headerSpace: { width: 28 }, headerTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" }, signedOut: { padding: 24, gap: 20, alignItems: "center" }, signedOutText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14 }, section: { marginTop: 20 }, sectionTitle: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20, marginHorizontal: 16, marginBottom: 8 }, card: { backgroundColor: "#FFF", paddingHorizontal: 16 }, row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" }, label: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 15 }, rowValue: { maxWidth: "68%", flexDirection: "row", alignItems: "center", gap: 5 }, value: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14, textAlign: "right" }, valueMuted: { color: "#999" }, arrow: { width: 16, height: 16 }, avatar: { width: 44, height: 44, borderRadius: 22 }, logoutButton: { height: 48, marginTop: 28, marginHorizontal: 16, borderRadius: 8, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" }, logoutText: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 15 }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }, modalCard: { backgroundColor: "#FFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 28, gap: 14 }, modalTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "600" }, notice: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 }, input: { height: 46, borderWidth: 1, borderColor: "#E7E7E7", borderRadius: 8, paddingHorizontal: 12, color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 15 }, genderOptions: { flexDirection: "row", gap: 10 }, genderOption: { flex: 1, height: 42, borderRadius: 8, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center" }, genderOptionActive: { backgroundColor: "#FFE8ED" }, genderOptionText: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 14 }, modalActions: { flexDirection: "row", gap: 12, marginTop: 4 }, cancelButton: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center" }, cancelText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 15 }, confirmButton: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#FF1F4C", alignItems: "center", justifyContent: "center" }, confirmText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15 } });
