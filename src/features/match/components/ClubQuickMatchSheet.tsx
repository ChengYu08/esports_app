import { Dismiss16Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
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
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ensureAuditionRoom,
  publishQuickMatch,
} from "@/features/match/api/match.api";
import type { MatchGame } from "@/features/match/api/match.types";
import { MatchLinearGradient } from "@/features/match/components/MatchLinearGradient";
import {
  MATCH_COMPANION_PREFERENCE_OPTIONS,
  MATCH_GENDER_OPTIONS,
  MATCH_REMARK_MAX,
  MATCH_VOICE_OPTIONS,
  useMatchForm,
} from "@/features/match/hooks/use-match-form";
import { exitVoiceRoom } from "@/features/voice-room/exit-voice-room";
import { resolveVoiceRoomId } from "@/features/voice-room/voice-room.api";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

const PUBLISH_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

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

function LightChip({
  label,
  selected,
  onPress,
  iconUrl,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  iconUrl?: string;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      {iconUrl ? (
        <Image source={{ uri: iconUrl }} style={styles.gameIcon} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, selected && styles.chipLabelSelected]}
      >
        {label}
      </Text>
    </Pressable>
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
  const activeRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const isReception = mode === "reception";
  const form = useMatchForm({
    enabled: visible,
    lockedClub: visible ? lockedClub : null,
    providedGames,
  });
  const [submitting, setSubmitting] = useState(false);
  const [exitRoomPromptVisible, setExitRoomPromptVisible] = useState(false);
  const pendingPublishRef = useRef<(() => Promise<void>) | null>(null);
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
      try {
        const room = await ensureAuditionRoom(requestNo, form.token);
        const roomId = resolveVoiceRoomId(room) || room.id;
        if (!roomId) throw new Error("试音房信息不存在");
        const game = options?.game;
        onClose();
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
        showToast(
          error instanceof Error
            ? `派单已发布，但${error.message}`
            : "派单已发布，但暂时无法进入试音房，请稍后重试",
        );
        return false;
      }
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
    setSubmitting(true);
    try {
      // 仅老板自发试音需退出当前房；接待代发在老板房间发起，不能退散老板房间
      if (!isReception && needVoice && activeRoom && user?.id) {
        await exitVoiceRoom(activeRoom, String(user.id), form.token);
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
      showToast(error instanceof Error ? error.message : "发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }, [
    activeRoom,
    buyerUserId,
    enterAuditionRoom,
    form,
    goMatching,
    isReception,
    onClose,
    submitting,
    user?.id,
  ]);

  const handlePublish = useCallback(() => {
    if (!isReception && form.voice === "需试音" && activeRoom) {
      pendingPublishRef.current = runPublish;
      setExitRoomPromptVisible(true);
      return;
    }
    void runPublish();
  }, [activeRoom, form.voice, isReception, runPublish]);

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
              <Dismiss16Regular color="rgba(0, 0, 0, 0.2)" width={13} height={13} />
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
                  <LightChip
                    key={game.id}
                    label={game.name}
                    iconUrl={game.iconUrl}
                    selected={form.gameId === game.id}
                    onPress={() => handleSelectGame(game.id)}
                    style={styles.gameChip}
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
                    <LightChip
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
                    <LightChip
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
                    <LightChip
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
                  <LightChip
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
                  <LightChip
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
                  <LightChip
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
            <LightFieldLabel label="备注" required />
            <View style={styles.remarkBox}>
              <TextInput
                value={form.remark}
                onChangeText={form.setRemark}
                placeholder="填写要求"
                placeholderTextColor="#CACACC"
                style={styles.remarkInput}
                maxLength={MATCH_REMARK_MAX + 1}
              />
            </View>
          </View>
          {form.remarkOverLimit ? (
            <Text style={styles.remarkError}>
              备注最多{MATCH_REMARK_MAX}字
            </Text>
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
            style={({ pressed }) => [
              styles.publishWrap,
              pressed && styles.pressed,
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
              <Text style={styles.publishText}>
                {submitting
                  ? "发布中..."
                  : isReception
                    ? "为老板发起派单"
                    : "立即发布，匹配陪玩"}
              </Text>
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
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#656566",
  },
  required: {
    fontFamily: DOUYIN_SANS,
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
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "#F5F6F7",
    borderWidth: 0.5,
    borderColor: "transparent",
    flexShrink: 0,
  },
  chipSelected: {
    backgroundColor: "#FFF5F7",
    borderColor: "#FE4267",
  },
  chipLabel: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "#0D0D0F",
    flexShrink: 0,
  },
  chipLabelSelected: {
    fontWeight: "500",
    color: "#FE1F4C",
  },
  gameChip: {
    minWidth: 116,
  },
  gameIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  clubName: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
  },
  hint: {
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    color: "#0D0D0F",
    padding: 0,
  },
  remarkError: {
    marginLeft: 77,
    marginTop: -8,
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
    color: "#0D0D0F",
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
    color: "#7F7F80",
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
