import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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

import { ClubSelectSheet } from "@/features/match/components/ClubSelectSheet";
import { FieldLabel } from "@/features/match/components/FieldLabel";
import { MatchOptionChip } from "@/features/match/components/MatchOptionChip";
import { MatchStepper } from "@/features/match/components/MatchStepper";
import {
  MATCH_COMPANION_PREFERENCE_OPTIONS,
  MATCH_GENDER_OPTIONS,
  MATCH_VOICE_OPTIONS,
  useMatchForm,
} from "@/features/match/hooks/use-match-form";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/match/icon-back.svg");
const arrowDownIcon = require("../../../../assets/match/icon-arrow-down.svg");
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

/** Figma dark bg：#0C0C2E → #120D2B */
const BG_GRADIENT = ["#0C0C2E", "#120D2B"] as const;
const PUBLISH_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
/**
 * Figma 按钮区 pb=56，其中 HomeIndicator=34，内容区余量=22。
 * 安全区用 insets 承接 HomeIndicator，仅保留 22 的内容间距。
 */
const FOOTER_CONTENT_BOTTOM = 22;
/** 备注输入框相对 ScrollView 可视底边的间距，避免底部被裁切 */
const REMARK_KEYBOARD_GAP = 12;

function HintText({ text }: { text: string }) {
  return <Text style={styles.hintText}>{text}</Text>;
}

export default function MatchScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const remarkFieldRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const remarkFocusedRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [clubSheetVisible, setClubSheetVisible] = useState(false);
  const form = useMatchForm();

  const handlePublish = () => {
    Toast.show("功能开发中", { duration: Toast.durations.SHORT });
  };

  const ensureRemarkAboveKeyboard = useCallback(() => {
    const scrollView = scrollRef.current;
    const remarkField = remarkFieldRef.current;
    if (!scrollView || !remarkField) return;

    // 以 ScrollView 可视区域底边为准，避免按窗口底边对齐时底部被裁切
    scrollView.measureInWindow((_sx, scrollY, _sw, scrollHeight) => {
      remarkField.measureInWindow((_x, y, _width, height) => {
        const fieldBottom = y + height;
        const visibleBottom = scrollY + scrollHeight;
        const delta = fieldBottom - visibleBottom + REMARK_KEYBOARD_GAP;
        if (delta <= 0) return;
        scrollView.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + delta),
          animated: true,
        });
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 底部栏隐藏、键盘顶起后再测量，避免 Android 位置不准
  useEffect(() => {
    if (!keyboardVisible || !remarkFocusedRef.current) return;
    const timer = setTimeout(ensureRemarkAboveKeyboard, Platform.OS === "android" ? 64 : 32);
    return () => clearTimeout(timer);
  }, [keyboardVisible, ensureRemarkAboveKeyboard]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={BG_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.background}
      />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.nav, { paddingTop: insets.top }]}>
          <View style={styles.navBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回"
              hitSlop={12}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
              style={styles.backButton}
            >
              <Image source={backIcon} style={styles.backIcon} />
            </Pressable>
            <Text style={styles.navTitle}>一键匹配</Text>
            <View style={styles.navRight} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            // 键盘弹出时增加底部空白，保证备注行能滚到可视区内且不被裁切
            keyboardVisible && { paddingBottom: 48 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.field}>
            <FieldLabel label="游戏" required />
            <View style={styles.gameOptions}>
              {form.gamesLoading ? (
                <ActivityIndicator color="#FE4267" />
              ) : form.games.length === 0 ? (
                <HintText text={form.token ? "暂无可选游戏" : "请先登录"} />
              ) : (
                form.games.map((game) => (
                  <MatchOptionChip
                    key={game.id}
                    label={game.name}
                    icon={game.iconUrl ? { uri: game.iconUrl } : undefined}
                    iconFallback
                    selected={form.gameId === game.id}
                    onPress={() => form.selectGame(game.id)}
                    style={styles.gameChip}
                  />
                ))
              )}
            </View>
          </View>

          <View style={styles.field}>
            <FieldLabel label="俱乐部" required />
            <View style={styles.options}>
              {form.clubsLoading && !form.club ? (
                <ActivityIndicator color="#FE4267" />
              ) : (
                <MatchOptionChip
                  label={form.club?.name ?? "请选择俱乐部"}
                  selected={Boolean(form.club)}
                  onPress={() => {
                    if (!form.gameId) {
                      Toast.show("请先选择游戏", { duration: Toast.durations.SHORT });
                      return;
                    }
                    setClubSheetVisible(true);
                  }}
                  trailing={<Image source={arrowDownIcon} style={styles.arrowIcon} />}
                />
              )}
            </View>
          </View>

          {form.club ? (
            <View style={styles.field}>
              <FieldLabel label="模式" required />
              <View style={styles.options}>
                {form.modesLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.modes.length === 0 ? (
                  <HintText text="该俱乐部暂无可用模式" />
                ) : (
                  form.modes.map((mode) => (
                    <MatchOptionChip
                      key={mode.id}
                      label={mode.name}
                      selected={form.modeId === mode.id}
                      onPress={() => form.selectMode(mode.id)}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}

          {form.modeId ? (
            <View style={styles.field}>
              <FieldLabel label="等级" required />
              <View style={styles.options}>
                {form.levelsLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.levels.length === 0 ? (
                  <HintText text="暂无可用等级" />
                ) : (
                  form.levels.map((level) => (
                    <MatchOptionChip
                      key={level.id}
                      label={level.name}
                      selected={form.levelId === level.id}
                      onPress={() => form.selectLevel(level.id)}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}

          {form.levelId ? (
            <View style={styles.field}>
              <FieldLabel label="服务" required />
              <View style={styles.options}>
                {form.servicesLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.services.length === 0 ? (
                  <HintText text="暂无可用服务" />
                ) : (
                  form.services.map((service) => (
                    <MatchOptionChip
                      key={service.id}
                      label={service.name}
                      selected={form.serviceId === service.id}
                      onPress={() => form.selectService(service.id)}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}

          {form.serviceId ? (
            <View style={styles.field}>
              <FieldLabel label="性别" required />
              <View style={styles.options}>
                {MATCH_GENDER_OPTIONS.map((option) => (
                  <MatchOptionChip
                    key={option.value}
                    label={option.label}
                    selected={form.gender === option.value}
                    onPress={() => form.setGender(option.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {form.showCompanionPreference ? (
            <View style={styles.field}>
              <FieldLabel label="陪玩人数" required />
              <View style={styles.options}>
                {MATCH_COMPANION_PREFERENCE_OPTIONS.map((option) => (
                  <MatchOptionChip
                    key={option.value}
                    label={option.label}
                    selected={form.companionPreference === option.value}
                    onPress={() => form.setCompanionPreference(option.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.field, styles.fieldCenter]}>
            <FieldLabel label="数量" required />
            <MatchStepper value={form.quantity} onChange={form.setQuantity} />
          </View>

          <View style={styles.field}>
            <FieldLabel label="试音" required />
            <View style={styles.options}>
              {MATCH_VOICE_OPTIONS.map((option) => (
                <MatchOptionChip
                  key={option}
                  label={option}
                  selected={form.voice === option}
                  onPress={() => form.setVoice(option)}
                />
              ))}
            </View>
          </View>

          <View ref={remarkFieldRef} style={[styles.field, styles.fieldCenter]} collapsable={false}>
            <FieldLabel label="备注" />
            <View style={styles.remarkBox}>
              <TextInput
                value={form.remark}
                onChangeText={form.setRemark}
                placeholder="填写要求"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.remarkInput}
                onFocus={() => {
                  remarkFocusedRef.current = true;
                }}
                onBlur={() => {
                  remarkFocusedRef.current = false;
                }}
              />
            </View>
          </View>

          <View style={[styles.field, styles.fieldCenter]}>
            <FieldLabel label="预估价格" required />
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{form.estimatedPriceText}</Text>
              <Image source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </View>
        </ScrollView>

        {keyboardVisible ? null : (
          <View style={[styles.footer, { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM }]}>
            <View style={styles.etaRow}>
              <Text style={styles.etaMuted}>预计</Text>
              <Text style={styles.etaAccent}>30s</Text>
              <Text style={styles.etaMuted}>内匹配成功</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="立即发布，匹配陪玩"
              onPress={handlePublish}
              style={({ pressed }) => [styles.publishWrap, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={PUBLISH_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.publishButton}
              >
                <Text style={styles.publishText}>立即发布，匹配陪玩</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <ClubSelectSheet
        visible={clubSheetVisible}
        clubs={form.clubs}
        selectedClubId={form.club?.id ?? null}
        loading={form.clubsLoading}
        onClose={() => setClubSheetVisible(false)}
        onConfirm={(nextClub) => {
          form.selectClub(nextClub);
          setClubSheetVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0C0C2E",
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    flex: 1,
  },
  nav: {
    width: "100%",
  },
  navBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 56,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  navRight: {
    width: 56,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 24,
  },
  field: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  fieldCenter: {
    alignItems: "center",
  },
  options: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  gameOptions: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  gameChip: {
    // Figma 选项卡基准宽 116；长名称按内容撑开，避免挤在固定宽度内
    minWidth: 116,
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  hintText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.4)",
  },
  remarkBox: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  remarkInput: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    padding: 0,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  diamondIcon: {
    width: 16,
    height: 16,
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  etaMuted: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.6)",
  },
  etaAccent: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#FE4267",
  },
  publishWrap: {
    width: "100%",
  },
  publishButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
  },
});
