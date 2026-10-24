import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

import {
  ensureAuditionRoom,
  publishQuickMatch,
} from "@/features/match/api/match.api";
import { ClubSelectSheet } from "@/features/match/components/ClubSelectSheet";
import { FieldLabel } from "@/features/match/components/FieldLabel";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { MatchOptionChip } from "@/features/match/components/MatchOptionChip";
import { MatchStepper } from "@/features/match/components/MatchStepper";
import {
  MATCH_COMPANION_PREFERENCE_OPTIONS,
  MATCH_GENDER_OPTIONS,
  MATCH_REMARK_MAX,
  MATCH_VOICE_OPTIONS,
  useMatchForm,
} from "@/features/match/hooks/use-match-form";
import { useRestoreActiveMatch } from "@/features/match/hooks/use-quick-match-session";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import { resolveVoiceRoomId } from "@/features/voice-room/voice-room.api";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/match/icon-back.svg");
const arrowDownIcon = require("../../../../assets/match/icon-arrow-down.svg");
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

const BG_GRADIENT = ["#0C0C2E", "#120D2B"] as const;
const PUBLISH_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
const FOOTER_CONTENT_BOTTOM = 22;
const REMARK_KEYBOARD_GAP = 12;

function HintText({ text }: { text: string }) {
  return <Text style={styles.hintText}>{text}</Text>;
}

export default function MatchPublishScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollAreaRef = useRef<View>(null);
  const remarkFieldRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const remarkFocusedRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [clubSheetVisible, setClubSheetVisible] = useState(false);
  const [exitRoomPromptVisible, setExitRoomPromptVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingPublishRef = useRef<(() => Promise<void>) | null>(null);

  const user = useAuthStore((state) => state.user);
  const activeRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const form = useMatchForm();
  const { restoring } = useRestoreActiveMatch();

  const ensureRemarkAboveKeyboard = useCallback(() => {
    const scrollView = scrollRef.current;
    const scrollArea = scrollAreaRef.current;
    const remarkField = remarkFieldRef.current;
    if (!scrollView || !scrollArea || !remarkField) return;

    scrollArea.measureInWindow((_sx, scrollY, _sw, scrollHeight) => {
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

  useEffect(() => {
    if (!keyboardVisible || !remarkFocusedRef.current) return;
    const timer = setTimeout(ensureRemarkAboveKeyboard, Platform.OS === "android" ? 64 : 32);
    return () => clearTimeout(timer);
  }, [keyboardVisible, ensureRemarkAboveKeyboard]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const enterAuditionRoom = useCallback(
    async (
      requestNo: string,
      options?: {
        expireTime?: string;
        game?: { id: string; name: string; iconUrl?: string } | null;
      },
    ) => {
      if (!form.token) return false;
      try {
        const room = await ensureAuditionRoom(requestNo, form.token);
        const roomId = resolveVoiceRoomId(room) || room.id;
        if (!roomId) throw new Error("试音房信息不存在");
        const game = options?.game;
        // replace：替换发布页，避免语聊房返回又回到发布表单（与不试音 goMatching 一致）
        router.replace({
          pathname: "/voice-room/[id]",
          params: {
            id: roomId,
            scene: "audition",
            requestNo,
            ...(options?.expireTime ? { expireTime: options.expireTime } : {}),
            ...(game?.id && game.name
              ? {
                  gameId: game.id,
                  gameName: game.name,
                  ...(game.iconUrl ? { gameIconUrl: game.iconUrl } : {}),
                }
              : {}),
          },
        });
        return true;
      } catch (error) {
        Toast.show(
          error instanceof Error
            ? `派单已发布，但${error.message}`
            : "派单已发布，但暂时无法进入试音房，请稍后重试",
          { duration: Toast.durations.SHORT },
        );
        return false;
      }
    },
    [form.token],
  );

  const goMatching = useCallback(
    (
      requestNo: string,
      expireTime?: string,
      game?: { id: string; name: string; iconUrl?: string } | null,
    ) => {
      router.replace({
        pathname: "/match/matching/[requestNo]",
        params: {
          requestNo,
          ...(expireTime ? { expireTime } : {}),
          ...(game?.id && game.name
            ? {
                gameId: game.id,
                gameName: game.name,
                ...(game.iconUrl ? { gameIconUrl: game.iconUrl } : {}),
              }
            : {}),
        },
      });
    },
    [],
  );

  const runPublish = useCallback(async () => {
    if (!form.token) {
      Toast.show("请先登录", { duration: Toast.durations.SHORT });
      return;
    }
    if (!form.club?.id) {
      Toast.show("请先选择俱乐部", { duration: Toast.durations.SHORT });
      return;
    }
    if (!form.gameId || !form.modeId || !form.levelId || !form.serviceId) {
      Toast.show("请完整选择服务模式", { duration: Toast.durations.SHORT });
      return;
    }
    if (form.showCompanionPreference && !form.companionPreference) {
      Toast.show("请选择单陪或双陪", { duration: Toast.durations.SHORT });
      return;
    }
    if (form.remarkOverLimit) {
      Toast.show(`备注最多${MATCH_REMARK_MAX}字`, { duration: Toast.durations.SHORT });
      return;
    }
    if (submitting) return;

    const needVoice = form.voice === "需试音";
    setSubmitting(true);
    try {
      if (needVoice && activeRoom && user?.id) {
        await exitVoiceRoom(activeRoom, String(user.id), form.token);
      }

      const result = await publishQuickMatch(
        {
          clubId: Number(form.club.id),
          publishType: "BUYER",
          gameId: Number(form.gameId),
          gameModeId: Number(form.modeId),
          gameLevelId: Number(form.levelId),
          gameServiceId: Number(form.serviceId),
          genderRequirement: form.gender,
          quantity: form.quantity,
          needVoice,
          companionPreference: form.showCompanionPreference
            ? form.companionPreference || undefined
            : undefined,
          remark: form.remark.trim() || undefined,
        },
        form.token,
      );

      const selectedGame = form.games.find((item) => item.id === form.gameId);
      if (needVoice) {
        // 需试音：直接进试音房，不落匹配等待页；选人由房内「选择陪玩」再 push
        await enterAuditionRoom(result.requestNo, {
          expireTime: result.expireTime,
          game: selectedGame ?? null,
        });
      } else {
        goMatching(result.requestNo, result.expireTime, selectedGame ?? null);
      }
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "发布失败，请重试", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSubmitting(false);
    }
  }, [activeRoom, enterAuditionRoom, form, goMatching, submitting, user?.id]);

  const handlePublish = useCallback(() => {
    if (form.voice === "需试音" && activeRoom) {
      pendingPublishRef.current = runPublish;
      setExitRoomPromptVisible(true);
      return;
    }
    void runPublish();
  }, [activeRoom, form.voice, runPublish]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <MatchLinearGradient
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
              onPress={goBack}
              style={styles.backButton}
            >
              <Image source={backIcon} style={styles.backIcon} />
            </Pressable>
            <Text style={styles.navTitle}>一键匹配</Text>
            <View style={styles.navRight} />
          </View>
        </View>

        {restoring ? (
          <View style={styles.restoring}>
            <ActivityIndicator color="#FE4267" />
          </View>
        ) : (
          <>
            <View ref={scrollAreaRef} style={styles.scroll} collapsable={false}>
              <ScrollView
                ref={scrollRef}
                style={styles.scrollFlex}
                contentContainerStyle={[
                  styles.scrollContent,
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

                <View
                  ref={remarkFieldRef}
                  style={[styles.field, styles.fieldCenter]}
                  collapsable={false}
                >
                  <FieldLabel label="备注" />
                  <View style={styles.remarkBox}>
                    <TextInput
                      value={form.remark}
                      onChangeText={form.setRemark}
                      placeholder="填写要求"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={styles.remarkInput}
                      maxLength={MATCH_REMARK_MAX + 1}
                      onFocus={() => {
                        remarkFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        remarkFocusedRef.current = false;
                      }}
                    />
                  </View>
                </View>
                {form.remarkOverLimit ? (
                  <Text style={styles.remarkError}>备注最多{MATCH_REMARK_MAX}字</Text>
                ) : null}

                <View style={[styles.field, styles.fieldCenter]}>
                  <FieldLabel label="预估价格" required />
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>{form.estimatedPriceText}</Text>
                    <Image source={diamondIcon} style={styles.diamondIcon} />
                  </View>
                </View>
              </ScrollView>
            </View>

            {keyboardVisible ? null : (
              <View
                style={[styles.footer, { paddingBottom: insets.bottom + FOOTER_CONTENT_BOTTOM }]}
              >
                <View style={styles.etaRow}>
                  <Text style={styles.etaMuted}>预计</Text>
                  <Text style={styles.etaAccent}>30s</Text>
                  <Text style={styles.etaMuted}>内匹配成功</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="立即发布，匹配陪玩"
                  disabled={submitting || form.remarkOverLimit}
                  onPress={handlePublish}
                  style={({ pressed }) => [styles.publishWrap, pressed && styles.pressed]}
                >
                  <MatchLinearGradient
                    colors={PUBLISH_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.publishButton,
                      (submitting || form.remarkOverLimit) && styles.publishDisabled,
                    ]}
                  >
                    <Text style={styles.publishText}>
                      {submitting ? "发布中..." : "立即发布，匹配陪玩"}
                    </Text>
                  </MatchLinearGradient>
                </Pressable>
              </View>
            )}
          </>
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

      <AppPrompt
        visible={exitRoomPromptVisible}
        title="提示"
        message="您当前正在语音房中，发布试音需求将退出或解散当前房间，是否继续？"
        confirmText="继续"
        cancelText="取消"
        onCancel={() => {
          setExitRoomPromptVisible(false);
          pendingPublishRef.current = null;
        }}
        onConfirm={() => {
          setExitRoomPromptVisible(false);
          const task = pendingPublishRef.current;
          pendingPublishRef.current = null;
          if (task) void task();
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
  restoring: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollFlex: {
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
  remarkError: {
    marginLeft: 56,
    marginTop: -16,
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 16,
    color: "#FE4267",
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
  publishDisabled: {
    opacity: 0.5,
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
