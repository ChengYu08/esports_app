import { useAuthStore } from "@esports/auth";
import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchActiveQuickMatch,
  publishQuickMatch,
} from "@/features/match/api/match.api";
import {
  isQuickMatchActive,
  type MatchGame,
} from "@/features/match/api/match.types";
import { LightGameOptionChip } from "@/features/match/components/LightGameOptionChip";
import { LightOptionChip } from "@/features/match/components/LightOptionChip";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import { openAuditionRoom } from "@/features/match/enter-audition-room";
import { isExistingDispatchConflictMessage } from "@/features/match/existing-dispatch-hint";
import {
  MATCH_COMPANION_PREFERENCE_OPTIONS,
  MATCH_GENDER_OPTIONS,
  MATCH_REMARK_MAX,
  MATCH_VOICE_OPTIONS,
  useMatchForm,
} from "@/features/match/hooks/use-match-form";
import {
  ensureRealNameBeforeVoiceRoomEnter,
  promptSelfRealNameIfNeeded,
} from "@/features/voice-room/ensure-real-name-before-enter";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import {
  resolveVoiceRoomId,
  voiceRoomApi,
} from "@/features/voice-room/voice-room.api";
import type { VoiceRoomDetail } from "@/features/voice-room/voice-room.types";
import { getDDinProStyle } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { showToast } from "@/shared/ui/app-toast";

const diamondIcon = require("../../../../assets/mine/star-recharge-diamond-3f6fcf.png");

const PUBLISH_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

/** 发布按钮内的三个跳动小点 */
function PublishingDots() {
  return (
    <View style={styles.publishingDots}>
      {[0, 1, 2].map((i) => (
        <PublishingDot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function PublishingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 480, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.publishingDot, animatedStyle]} />;
}

type ClubQuickMatchSheetProps = {
  visible: boolean;
  onClose: () => void;
  club: { id: string; name: string };
  /** 当前俱乐部启用的游戏（对齐 PC club 模式 props.games） */
  games: MatchGame[];
  initialGameId?: string;
  /**
   * club：俱乐部页老板自发；
   * reception：语聊房接待代发（买家为房主，固定需试音，发布后由老板端接管）
   */
  mode?: "club" | "reception";
  /** 接待代发时的老板用户 ID（mode=reception 必传） */
  buyerUserId?: string | number;
  /** 接待代发时展示的老板昵称 */
  buyerNickname?: string;
};

function LightFieldLabel({
  label,
  required = false,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <View style={styles.labelCol}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>
    </View>
  );
}

function LightStepper({
  value,
  min = 1,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  const canDecrease = value > min;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="减少数量"
        disabled={!canDecrease}
        hitSlop={8}
        onPress={() => {
          if (canDecrease) onChange(value - 1);
        }}
        style={styles.stepperSide}
      >
        <Text
          style={[
            styles.stepperGlyph,
            !canDecrease && styles.stepperGlyphDisabled,
          ]}
        >
          −
        </Text>
      </Pressable>
      <View style={styles.stepperDivider} />
      <View style={styles.stepperNumber}>
        <Text style={styles.stepperNumberText}>{value}</Text>
      </View>
      <View style={styles.stepperDivider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="增加数量"
        hitSlop={8}
        onPress={() => onChange(value + 1)}
        style={styles.stepperSide}
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function ClubQuickMatchSheet({
  visible,
  onClose,
  club: lockedClub,
  games: providedGames,
  initialGameId,
  mode = "club",
  buyerUserId,
  buyerNickname,
}: ClubQuickMatchSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const isReception = mode === "reception";
  const form = useMatchForm({
    enabled: visible,
    lockedClub: visible ? lockedClub : null,
    providedGames,
  });
  const [submitting, setSubmitting] = useState(false);
  const [exitRoomPromptVisible, setExitRoomPromptVisible] = useState(false);
  const pendingPublishRef = useRef<(() => Promise<void>) | null>(null);
  const joinedRoomRef = useRef<VoiceRoomDetail | null>(null);
  const checkingJoinedRoomRef = useRef(false);
  /** 本次打开是否已完成初始游戏对齐；之后用户手选不再被 initialGameId 覆盖 */
  const gameBootstrappedRef = useRef(false);
  const scrollMaxHeight = Math.max(280, windowHeight * 0.55);

  // 仅首次打开时对齐 initialGameId；俱乐部锁定交给 useMatchForm.lockedClub
  useEffect(() => {
    if (!visible) {
      gameBootstrappedRef.current = false;
      return;
    }
    if (gameBootstrappedRef.current) return;
    if (form.gamesLoading || form.games.length === 0) return;

    const preferred =
      (initialGameId && form.games.some((g) => g.id === initialGameId)
        ? initialGameId
        : null) ?? form.games[0]?.id;
    if (!preferred) return;

    if (form.gameId !== preferred) {
      // 目标即默认第一项且尚未选中：交给 useMatchForm 自动 setGameId
      if (form.gameId === null && preferred === form.games[0]?.id) {
        return;
      }
      form.selectGame(preferred);
      return;
    }
    gameBootstrappedRef.current = true;
  }, [
    visible,
    form.gamesLoading,
    form.games,
    form.gameId,
    form.selectGame,
    initialGameId,
  ]);

  const handleSelectGame = useCallback(
    (gameId: string) => {
      if (form.gameId === gameId) return;
      form.selectGame(gameId);
    },
    [form.gameId, form.selectGame],
  );

  const enterAuditionRoom = useCallback(
    async (
      requestNo: string,
      options?: {
        expireTime?: string;
        game?: { id: string; name: string; iconUrl?: string } | null;
      },
    ) => {
      if (!form.token) return false;
      onClose();
      return openAuditionRoom(requestNo, form.token, options);
    },
    [form.token, onClose],
  );

  const goMatching = useCallback(
    (
      requestNo: string,
      expireTime?: string,
      game?: { id: string; name: string; iconUrl?: string } | null,
    ) => {
      onClose();
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
    [onClose],
  );

  const runPublish = useCallback(async () => {
    if (!form.token) {
      showToast("请先登录");
      return;
    }
    if (!form.club?.id) {
      showToast("请先选择俱乐部");
      return;
    }
    if (!form.gameId || !form.modeId || !form.levelId || !form.serviceId) {
      showToast("请完整选择服务模式");
      return;
    }
    if (form.showCompanionPreference && !form.companionPreference) {
      showToast("请选择单陪或双陪");
      return;
    }
    if (form.remarkOverLimit) {
      showToast(`备注最多${MATCH_REMARK_MAX}字`);
      return;
    }
    if (isReception && !buyerUserId) {
      showToast("未识别到下单老板，请重试");
      return;
    }
    if (submitting) return;

    // 接待代发固定需试音，由老板端接管进房；老板自发仍按表单选择
    const needVoice = isReception ? true : form.voice === "需试音";
    // 仅「会进试音房」的老板自发路径拦实名；接待纯代发不进房
    if (!isReception && needVoice && !(await ensureRealNameBeforeVoiceRoomEnter())) {
      return;
    }
    setSubmitting(true);
    try {
      // 仅老板自发试音需退出当前房；接待代发在老板房间发起，不能退散老板房间
      const joinedRoom = joinedRoomRef.current;
      joinedRoomRef.current = null;
      const joinedRoomId = joinedRoom ? resolveVoiceRoomId(joinedRoom) : null;
      if (!isReception && needVoice && joinedRoom && joinedRoomId && user?.id) {
        await exitVoiceRoom(
          {
            roomId: joinedRoomId,
            roomVersion: joinedRoom.roomVersion ?? "1",
            creatorUserId: joinedRoom.creatorUserId,
            rongChatroomId: joinedRoom.rongChatroomId,
          },
          String(user.id),
          form.token,
        );
      }

      const result = await publishQuickMatch(
        {
          clubId: Number(form.club.id),
          publishType: isReception ? "RECEPTION" : "BUYER",
          buyerUserId: isReception ? Number(buyerUserId) : undefined,
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

      if (isReception) {
        showToast("已为老板发起派单");
        onClose();
        return;
      }

      const selectedGame = form.games.find((item) => item.id === form.gameId);
      if (needVoice) {
        await enterAuditionRoom(result.requestNo, {
          expireTime: result.expireTime,
          game: selectedGame ?? null,
        });
      } else {
        goMatching(result.requestNo, result.expireTime, selectedGame ?? null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "发布失败，请重试";
      if (await promptSelfRealNameIfNeeded(message)) {
        return;
      }
      // 接待代发撞老板已有派单：保持 Toast，不替老板恢复进房
      if (!isReception && isExistingDispatchConflictMessage(message)) {
        try {
          const active = await fetchActiveQuickMatch(form.token);
          if (active && isQuickMatchActive(active)) {
            const activeGame =
              active.gameId && active.gameName
                ? { id: active.gameId, name: active.gameName }
                : null;
            if (active.needVoice === false) {
              goMatching(active.requestNo, active.expireTime, activeGame);
              return;
            }
            const entered = await enterAuditionRoom(active.requestNo, {
              expireTime: active.expireTime,
              game: activeGame,
            });
            if (!entered) {
              goMatching(active.requestNo, active.expireTime, activeGame);
            }
            return;
          }
        } catch {
          // 恢复查询失败则落回原错误文案
        }
      }
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    buyerUserId,
    enterAuditionRoom,
    form,
    goMatching,
    isReception,
    onClose,
    submitting,
    user?.id,
  ]);

  const handlePublish = useCallback(async () => {
    // 先完成表单必填校验，再查语聊房，避免未选配置就弹退房提示
    if (!form.token) {
      showToast("请先登录");
      return;
    }
    if (!form.club?.id) {
      showToast("请先选择俱乐部");
      return;
    }
    if (!form.gameId || !form.modeId || !form.levelId || !form.serviceId) {
      showToast("请完整选择服务模式");
      return;
    }
    if (form.showCompanionPreference && !form.companionPreference) {
      showToast("请选择单陪或双陪");
      return;
    }
    if (form.remarkOverLimit) {
      showToast(`备注最多${MATCH_REMARK_MAX}字`);
      return;
    }
    if (isReception && !buyerUserId) {
      showToast("未识别到下单老板，请重试");
      return;
    }

    if (isReception || form.voice !== "需试音") {
      joinedRoomRef.current = null;
      void runPublish();
      return;
    }
    if (checkingJoinedRoomRef.current || submitting) return;
    checkingJoinedRoomRef.current = true;
    try {
      const joined = await voiceRoomApi.getJoinedRoom(form.token);
      const joinedId = resolveVoiceRoomId(joined);
      if (joined && joinedId) {
        joinedRoomRef.current = joined;
        pendingPublishRef.current = runPublish;
        setExitRoomPromptVisible(true);
        return;
      }
      joinedRoomRef.current = null;
      void runPublish();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "查询语聊房状态失败，请重试",
      );
    } finally {
      checkingJoinedRoomRef.current = false;
    }
  }, [buyerUserId, form, isReception, runPublish, submitting]);

  const clubDisplayName = form.club?.name || lockedClub.name;

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        dismissOnBackdropPress={!submitting}
        keyboardAvoiding
        contentStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={[styles.header, isReception && styles.headerTall]}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>
              {isReception ? "客服派单" : "一键匹配"}
            </Text>
            {isReception ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                帮「{buyerNickname || "老板"}」派单
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="关闭"
            hitSlop={8}
            disabled={submitting}
            onPress={onClose}
            style={styles.closeButton}
          >
            <View style={styles.closeIcon}>
              <Dismiss16Regular
                color="rgba(0, 0, 0, 0.2)"
                width={13}
                height={13}
              />
            </View>
          </Pressable>
        </View>

        <ScrollView
          style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <LightFieldLabel label="游戏" required />
            <View style={styles.options}>
              {form.gamesLoading ? (
                <ActivityIndicator color="#FE4267" />
              ) : form.games.length === 0 ? (
                <Text style={styles.hint}>
                  {form.token ? "暂无可选游戏" : "请先登录"}
                </Text>
              ) : (
                form.games.map((game) => (
                  <LightGameOptionChip
                    key={game.id}
                    label={game.name}
                    icon={game.iconUrl ? { uri: game.iconUrl } : undefined}
                    iconFallback
                    selected={form.gameId === game.id}
                    onPress={() => handleSelectGame(game.id)}
                  />
                ))
              )}
            </View>
          </View>

          <View style={[styles.field, styles.fieldCenter]}>
            <LightFieldLabel label="俱乐部" required />
            <Text style={styles.clubName} numberOfLines={1}>
              {clubDisplayName}
            </Text>
          </View>

          {form.club ? (
            <View style={styles.field}>
              <LightFieldLabel label="模式" required />
              <View style={styles.options}>
                {form.modesLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.modes.length === 0 ? (
                  <Text style={styles.hint}>该俱乐部暂无可用模式</Text>
                ) : (
                  form.modes.map((mode) => (
                    <LightOptionChip
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
              <LightFieldLabel label="等级" required />
              <View style={styles.options}>
                {form.levelsLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.levels.length === 0 ? (
                  <Text style={styles.hint}>暂无可用等级</Text>
                ) : (
                  form.levels.map((level) => (
                    <LightOptionChip
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
              <LightFieldLabel label="服务" required />
              <View style={styles.options}>
                {form.servicesLoading ? (
                  <ActivityIndicator color="#FE4267" />
                ) : form.services.length === 0 ? (
                  <Text style={styles.hint}>暂无可用服务</Text>
                ) : (
                  form.services.map((service) => (
                    <LightOptionChip
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
              <LightFieldLabel label="性别" required />
              <View style={styles.options}>
                {MATCH_GENDER_OPTIONS.map((option) => (
                  <LightOptionChip
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
              <LightFieldLabel label="陪玩人数" required />
              <View style={styles.options}>
                {MATCH_COMPANION_PREFERENCE_OPTIONS.map((option) => (
                  <LightOptionChip
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
            <LightFieldLabel label="数量" required />
            <LightStepper value={form.quantity} onChange={form.setQuantity} />
          </View>

          {!isReception ? (
            <View style={styles.field}>
              <LightFieldLabel label="试音" required />
              <View style={styles.options}>
                {MATCH_VOICE_OPTIONS.map((option) => (
                  <LightOptionChip
                    key={option}
                    label={option}
                    selected={form.voice === option}
                    onPress={() => form.setVoice(option)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.field, styles.fieldCenter]}>
            <LightFieldLabel label="备注" />
            <View style={styles.remarkBox}>
              <TextInput
                value={form.remark}
                onChangeText={form.setRemark}
                placeholder="填写要求"
                placeholderTextColor="#CACACC"
                style={styles.remarkInput}
                maxLength={MATCH_REMARK_MAX + 1}
                cursorColor="#FE1F4C"
              />
            </View>
          </View>
          {form.remarkOverLimit ? (
            <Text style={styles.remarkError}>备注最多{MATCH_REMARK_MAX}字</Text>
          ) : null}

          <View style={[styles.field, styles.fieldCenter]}>
            <LightFieldLabel label="预估价格" required />
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{form.estimatedPriceText}</Text>
              <Image source={diamondIcon} style={styles.diamondIcon} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="立即发布，匹配陪玩"
            disabled={submitting || form.remarkOverLimit}
            onPress={handlePublish}
            style={({ pressed }) => [
              styles.publishWrap,
              pressed && !submitting && styles.pressed,
              submitting && styles.publishWrapBusy,
            ]}
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
              {submitting ? (
                <View style={styles.publishBusyRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.publishText}>发布中</Text>
                  <PublishingDots />
                </View>
              ) : (
                <Text style={styles.publishText}>
                  {isReception ? "为老板发起派单" : "立即发布，匹配陪玩"}
                </Text>
              )}
            </MatchLinearGradient>
          </Pressable>
        </View>
      </BottomSheet>

      <AppPrompt
        visible={exitRoomPromptVisible}
        title="提示"
        message="您当前正在语音房中，发布试音需求将退出或解散当前房间，是否继续？"
        confirmText="继续"
        cancelText="取消"
        onCancel={() => {
          setExitRoomPromptVisible(false);
          pendingPublishRef.current = null;
          joinedRoomRef.current = null;
        }}
        onConfirm={() => {
          setExitRoomPromptVisible(false);
          const task = pendingPublishRef.current;
          pendingPublishRef.current = null;
          if (task) void task();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerTitles: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  subtitle: {
    marginTop: 4,
    color: "#979799",
    fontSize: 12,
    lineHeight: 18,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "92%",
    overflow: "hidden",
  },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTall: {
    height: 64,
    alignItems: "flex-start",
    paddingTop: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#0D0D0F",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  field: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  fieldCenter: {
    alignItems: "center",
  },
  labelCol: {
    width: 65,
    paddingVertical: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  labelText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#656566",
  },
  required: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#FE4267",
  },
  options: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  clubName: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#999999",
  },
  stepper: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#F7F7F7",
  },
  stepperSide: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
    color: "#0A0A0A",
  },
  stepperGlyphDisabled: {
    color: "#CACACC",
  },
  stepperDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: "#E5E5E5",
  },
  stepperNumber: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  stepperNumberText: {
    fontSize: 12,
    lineHeight: 22,
    fontWeight: "500",
    color: "#0A0A0A",
    textAlign: "center",
  },
  remarkBox: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  remarkInput: {
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
    padding: 0,
  },
  remarkError: {
    marginLeft: 77,
    marginTop: -8,
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
    fontSize: 18,
    lineHeight: 22,
    color: "#0D0D0F",
    ...getDDinProStyle(600),
  },
  diamondIcon: {
    width: 16,
    height: 16,
  },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 8,
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
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  publishWrapBusy: {
    transform: [{ scale: 0.98 }],
  },
  publishBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  publishingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 2,
  },
  publishingDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.85,
  },
});
