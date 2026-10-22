import {
  courtApi,
  formatTime,
  makeIdempotencyKey,
  type CourtCaseType,
  type CourtSource,
} from "@/features/court/court.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

type Mode = "court" | "ticket" | "evidence" | "appeal";
type UploadItem = {
  uri: string;
  name: string;
  mimeType?: string | null;
  key?: string;
  retained?: boolean;
};
const CASE_TYPES: { code: CourtCaseType; label: string }[] = [
  { code: "DELETE_REVIEW", label: "删除差评" },
  { code: "RETRAIN", label: "重新培训" },
  { code: "APOLOGY", label: "诉求道歉" },
  { code: "FINE", label: "要求罚款" },
];
const TICKET_REASONS = [
  ["RULE_VIOLATION", "违反平台规定"],
  ["ORDER_DISPUTE", "订单纠纷"],
  ["CHAT_DISPUTE", "聊天纠纷"],
  ["OTHER", "其他"],
  ["PLATFORM_SUGGESTION", "平台建议"],
] as const;

export default function CourtComplaintScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    caseId?: string;
    ticketId?: string;
    targetUid?: string;
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [mode, setMode] = useState<Mode>(() => validMode(params.mode));
  const [caseType, setCaseType] = useState<CourtCaseType | "">("");
  const [ticketReason, setTicketReason] = useState<string>("");
  const [claim, setClaim] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<UploadItem[]>([]);
  const [sources, setSources] = useState<CourtSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<CourtSource | null>(
    null,
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [agree, setAgree] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targets, setTargets] = useState<
    { id: string; nickname: string; headImage?: string }[]
  >([]);
  const [target, setTarget] = useState<{
    id: string;
    nickname: string;
    headImage?: string;
  } | null>(() =>
    params.targetUid
      ? { id: params.targetUid, nickname: `用户 ${params.targetUid}` }
      : null,
  );
  const [targetLoading, setTargetLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof courtApi.getDetail>
  > | null>(null);
  const [ticketDetail, setTicketDetail] = useState<Awaited<
    ReturnType<typeof courtApi.getTicketDetail>
  > | null>(null);
  const isDeleteReview = caseType === "DELETE_REVIEW";
  const title =
    mode === "court"
      ? params.caseId
        ? "重新提交评审"
        : "发起投诉"
      : mode === "ticket"
        ? "发起投诉"
        : mode === "evidence"
          ? "补充举证"
          : "发起申诉";

  useEffect(() => {
    if (!params.caseId) return;
    let active = true;
    void courtApi
      .getDetail(params.caseId, true)
      .then((item) => {
        if (!active) return;
        if (params.caseId && !item.actions?.includes("RESUBMIT"))
          throw new Error("案件当前不可重新提交");
        setDetail(item);
        if (item.content) setContent(item.content);
        if (item.claim) setClaim(item.claim);
        if (
          item.caseType &&
          CASE_TYPES.some((value) => value.code === item.caseType)
        )
          setCaseType(item.caseType as CourtCaseType);
        if (item.sourceOrderId || item.sourceReviewId)
          setSelectedSource({
            orderId: item.sourceOrderId,
            reviewId: item.sourceReviewId,
            orderNo: item.orderNo,
            companionNickname: item.companionNickname,
            companionAvatar: item.companionAvatar,
          });
        setImages(
          Object.entries(item.editableEvidence ?? {}).map(
            ([key, uri], index) => ({
              uri,
              name: `retained-${index}`,
              key,
              retained: true,
            }),
          ),
        );
      })
      .catch((error) =>
        Toast.show(error instanceof Error ? error.message : "案件加载失败", {
          duration: Toast.durations.SHORT,
        }),
      );
    return () => {
      active = false;
    };
  }, [params.caseId]);

  useEffect(() => {
    if (!params.ticketId) return;
    let active = true;
    void courtApi
      .getTicketDetail(params.ticketId, true)
      .then((item) => {
        if (!active) return;
        if (item.status !== "REJECTED") throw new Error("工单当前不可重新提交");
        setTicketDetail(item);
        if (item.reasonType) setTicketReason(item.reasonType);
        if (item.content) setContent(item.content);
        if (item.targetUid)
          setTarget({
            id: item.targetUid,
            nickname: item.targetNickname || `用户 ${item.targetUid}`,
            headImage: item.targetAvatar,
          });
        setImages(
          Object.entries(item.editableEvidence ?? {}).map(
            ([key, uri], index) => ({
              uri,
              name: `retained-${index}`,
              key,
              retained: true,
            }),
          ),
        );
      })
      .catch((error) =>
        Toast.show(error instanceof Error ? error.message : "工单加载失败", {
          duration: Toast.durations.SHORT,
        }),
      );
    return () => {
      active = false;
    };
  }, [params.ticketId]);

  const sourceLabel = useMemo(() => {
    if (!selectedSource) return "请选择";
    return `${isDeleteReview ? "差评订单" : "订单"} ${selectedSource.orderNo || selectedSource.orderId || ""}`;
  }, [isDeleteReview, selectedSource]);

  async function openSources() {
    if (!caseType) {
      Toast.show("请先选择诉求类型", { duration: Toast.durations.SHORT });
      return;
    }
    setPickerVisible(true);
    setSourceLoading(true);
    try {
      setSources(await courtApi.getSources(caseType));
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "订单加载失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSourceLoading(false);
    }
  }

  async function chooseSource(source: CourtSource) {
    if (!source.orderId && !source.reviewId) return;
    try {
      const preview = await courtApi.previewSource({
        caseType: caseType as CourtCaseType,
        orderId: isDeleteReview ? undefined : source.orderId,
        reviewId: isDeleteReview ? source.reviewId : undefined,
      });
      setSelectedSource(preview);
    } catch {
      setSelectedSource(source);
    }
    setPickerVisible(false);
  }

  async function pickImages() {
    if (images.length >= 9 || submitting) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要相册权限", "允许访问相册后才能添加证据截图");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 9 - images.length,
      quality: 0.9,
    });
    if (result.canceled) return;
    const picked = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `court-evidence-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType,
    }));
    setImages((current) => [...current, ...picked].slice(0, 9));
  }

  async function uploadAll() {
    const uploaded: UploadItem[] = [];
    for (const image of images) {
      if (image.key) {
        uploaded.push(image);
        continue;
      }
      const key = await courtApi.uploadEvidence(
        image.uri,
        image.name,
        image.mimeType,
      );
      uploaded.push({ ...image, key });
      setImages((current) =>
        current.map((row) => (row.uri === image.uri ? { ...row, key } : row)),
      );
    }
    return uploaded
      .map((image) => image.key)
      .filter((key): key is string => Boolean(key));
  }

  async function findTarget() {
    if (!targetInput.trim()) {
      Toast.show("请输入用户ID或昵称", { duration: Toast.durations.SHORT });
      return;
    }
    setTargetLoading(true);
    try {
      const rows = await courtApi.searchTargets(targetInput.trim());
      setTargets(rows);
      if (!rows.length)
        Toast.show("没有找到该用户", { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "查找失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setTargetLoading(false);
    }
  }

  async function submit() {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (submitting) return;
    if (!content.trim()) {
      Toast.show("请填写投诉内容", { duration: Toast.durations.SHORT });
      return;
    }
    if (mode === "court" && (!caseType || !selectedSource || !agree)) {
      Toast.show("请完整填写评审信息并同意使用守则", {
        duration: Toast.durations.SHORT,
      });
      return;
    }
    if (
      mode === "ticket" &&
      (!ticketReason ||
        (ticketReason !== "PLATFORM_SUGGESTION" && !target) ||
        !agree)
    ) {
      Toast.show("请完整填写工单信息并同意使用守则", {
        duration: Toast.durations.SHORT,
      });
      return;
    }
    if ((mode === "appeal" || mode === "evidence") && !params.caseId) {
      Toast.show("案件信息缺失", { duration: Toast.durations.SHORT });
      return;
    }
    setSubmitting(true);
    try {
      const keys = await uploadAll();
      if (mode === "court") {
        const retainedKeys = images
          .filter((image) => image.retained && image.key)
          .map((image) => image.key as string);
        const input = {
          caseType: caseType as CourtCaseType,
          orderId: isDeleteReview ? undefined : selectedSource?.orderId,
          reviewId: isDeleteReview ? selectedSource?.reviewId : undefined,
          claim,
          content: content.trim(),
          evidenceObjectKeys: params.caseId
            ? keys.filter((key) => !retainedKeys.includes(key))
            : keys,
          idempotencyKey: makeIdempotencyKey(
            params.caseId ? "court-resubmit" : "court",
          ),
        };
        if (params.caseId)
          await courtApi.resubmitCase(params.caseId, input, retainedKeys);
        else await courtApi.createCase(input);
      } else if (mode === "ticket") {
        const retainedKeys = images
          .filter((image) => image.retained && image.key)
          .map((image) => image.key as string);
        const input = {
          reasonType: ticketReason,
          targetUid:
            ticketReason === "PLATFORM_SUGGESTION" ? undefined : target?.id,
          content: content.trim(),
          evidenceObjectKeys: params.ticketId
            ? keys.filter((key) => !retainedKeys.includes(key))
            : keys,
        };
        if (params.ticketId)
          await courtApi.resubmitTicket(params.ticketId, input, retainedKeys);
        else await courtApi.createTicket(input);
      } else if (mode === "evidence") {
        await courtApi.supplementEvidence(params.caseId!, keys, content.trim());
      } else {
        await courtApi.appeal(params.caseId!, content.trim(), keys);
      }
      Toast.show("提交成功", { duration: Toast.durations.SHORT });
      router.back();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "提交失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 48 },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {(mode === "court" || mode === "ticket") && (
          <>
            {!params.caseId && (
              <>
                <Text style={styles.requiredLabel}>发布类型</Text>
                <View style={styles.typeCards}>
                  {(["court", "ticket"] as Mode[]).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setMode(value)}
                      style={[
                        styles.typeCard,
                        mode === value && styles.typeCardSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeTitle,
                          mode === value && styles.typeTitleSelected,
                        ]}
                      >
                        {value === "court" ? "法庭评审" : "工单反馈"}
                      </Text>
                      <Text style={styles.typeDescription}>
                        {value === "court"
                          ? "适用于对服务不满意，申诉表达用户诉求"
                          : "适用于平台功能问题、发生其他纠纷的客服响应"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {mode === "court" ? (
              <>
                <Text style={styles.requiredLabel}>诉求类型</Text>
                <View style={styles.chips}>
                  {CASE_TYPES.map((item) => (
                    <Pressable
                      key={item.code}
                      onPress={() => {
                        setCaseType(item.code);
                        setSelectedSource(null);
                      }}
                      style={[
                        styles.chip,
                        caseType === item.code && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          caseType === item.code && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <FormField
                  label={isDeleteReview ? "需删除的订单差评" : "需处理订单信息"}
                  required
                >
                  <Pressable
                    onPress={() => void openSources()}
                    style={styles.selector}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectorText,
                        !selectedSource && styles.placeholder,
                      ]}
                    >
                      {sourceLabel}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </FormField>
                {selectedSource && (
                  <View style={styles.sourceInfo}>
                    <CachedImage
                      source={
                        selectedSource.companionAvatar
                          ? { uri: selectedSource.companionAvatar }
                          : undefined
                      }
                      style={styles.sourceAvatar}
                    />
                    <View style={styles.sourceText}>
                      <Text style={styles.sourceName}>
                        {selectedSource.companionNickname ||
                          selectedSource.defendantNickname ||
                          "服务用户"}
                      </Text>
                      <Text style={styles.sourceSub}>
                        {selectedSource.gameName || "订单"} ·
                        {selectedSource.orderNo || selectedSource.orderId}
                      </Text>
                    </View>
                  </View>
                )}
                <FormField label="个人诉求">
                  <TextInput
                    value={claim}
                    onChangeText={setClaim}
                    maxLength={50}
                    placeholder="请输入个人诉求"
                    placeholderTextColor="#b8b8b8"
                    style={styles.input}
                  />
                  <Text style={styles.counter}>{claim.length}/50</Text>
                </FormField>
              </>
            ) : (
              <>
                <Text style={styles.requiredLabel}>诉求类型</Text>
                <View style={styles.chips}>
                  {TICKET_REASONS.map(([code, label]) => (
                    <Pressable
                      key={code}
                      onPress={() => {
                        setTicketReason(code);
                        setTarget(null);
                      }}
                      style={[
                        styles.chip,
                        ticketReason === code && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          ticketReason === code && styles.chipTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {ticketReason !== "PLATFORM_SUGGESTION" && (
                  <FormField label="投诉对象" required>
                    {target ? (
                      <Pressable
                        onPress={() => setTarget(null)}
                        style={styles.targetPicked}
                      >
                        <CachedImage
                          source={
                            target.headImage
                              ? { uri: target.headImage }
                              : undefined
                          }
                          style={styles.targetAvatar}
                        />
                        <Text style={styles.sourceName}>
                          {target.nickname}　ID:{target.id}
                        </Text>
                        <Text style={styles.chevron}>×</Text>
                      </Pressable>
                    ) : (
                      <>
                        <View style={styles.targetSearch}>
                          <TextInput
                            value={targetInput}
                            onChangeText={setTargetInput}
                            placeholder="请输入投诉对象ID或昵称"
                            placeholderTextColor="#b8b8b8"
                            style={styles.targetInput}
                          />
                          <Pressable
                            onPress={() => void findTarget()}
                            disabled={targetLoading}
                            style={styles.findButton}
                          >
                            {targetLoading ? (
                              <ActivityIndicator color="#ff3158" />
                            ) : (
                              <Text style={styles.findText}>查找</Text>
                            )}
                          </Pressable>
                        </View>
                        {targets.map((candidate) => (
                          <Pressable
                            key={candidate.id}
                            onPress={() => {
                              setTarget(candidate);
                              setTargets([]);
                            }}
                            style={styles.targetCandidate}
                          >
                            <CachedImage
                              source={
                                candidate.headImage
                                  ? { uri: candidate.headImage }
                                  : undefined
                              }
                              style={styles.targetAvatar}
                            />
                            <Text style={styles.sourceName}>
                              {candidate.nickname}　ID:{candidate.id}
                            </Text>
                          </Pressable>
                        ))}
                      </>
                    )}
                  </FormField>
                )}
              </>
            )}
          </>
        )}

        {(mode === "appeal" || mode === "evidence") && !!detail && (
          <View style={styles.detailBanner}>
            <Text style={styles.detailBannerTitle}>
              {mode === "appeal" ? "申诉案件" : "待补充举证"}　
              {detail.caseNo || detail.caseId}
            </Text>
            <Text style={styles.detailBannerBody}>
              {detail.contentSummary || detail.content || ""}
            </Text>
            {mode === "appeal" && !!detail.rejectionReason && (
              <Text style={styles.rejection}>
                驳回原因：{detail.rejectionReason}
              </Text>
            )}
          </View>
        )}
        {mode === "ticket" && ticketDetail?.rejectionReason && (
          <View style={styles.detailBanner}>
            <Text style={styles.detailBannerTitle}>工单驳回原因</Text>
            <Text style={styles.rejection}>{ticketDetail.rejectionReason}</Text>
          </View>
        )}
        <FormField
          label={
            mode === "evidence"
              ? "举证说明"
              : mode === "appeal"
                ? "申诉理由"
                : "投诉内容"
          }
          required
        >
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
            placeholder={
              mode === "evidence"
                ? "请描述证据内容"
                : mode === "appeal"
                  ? "请填写申诉理由"
                  : mode === "court"
                    ? "请描述投诉原因"
                    : "请描述投诉内容"
            }
            placeholderTextColor="#b8b8b8"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{content.length}/1000</Text>
        </FormField>
        <View style={styles.uploadSection}>
          <View style={styles.uploadHeading}>
            <Text style={styles.requiredLabel}>证据截图</Text>
            <Text style={styles.counter}>({images.length}/9)</Text>
          </View>
          <View style={styles.images}>
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.imageWrap}>
                <Image source={{ uri: image.uri }} style={styles.image} />
                <Pressable
                  accessibilityLabel="删除图片"
                  onPress={() =>
                    setImages((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  style={styles.removeImage}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
                {image.key && (
                  <View style={styles.uploaded}>
                    <Text style={styles.uploadedText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < 9 && (
              <Pressable
                accessibilityLabel="添加证据图片"
                onPress={() => void pickImages()}
                style={styles.addImage}
              >
                <Text style={styles.addText}>＋</Text>
              </Pressable>
            )}
          </View>
        </View>
        {(mode === "court" || mode === "ticket") && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agree }}
            onPress={() => setAgree((value) => !value)}
            style={styles.agreement}
          >
            <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
              {agree && <Text style={styles.check}>✓</Text>}
            </View>
            <Text style={styles.agreementText}>
              我已阅读并同意{" "}
              <Text style={styles.agreementLink}>《小法庭用户使用守则》</Text>
            </Text>
          </Pressable>
        )}
        {!!params.caseId && !!detail?.rejectionReason && mode === "court" && (
          <Text style={styles.rejection}>
            驳回原因：{detail.rejectionReason}
          </Text>
        )}
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Pressable
          disabled={submitting}
          onPress={() => router.back()}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={styles.submit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>确认提交</Text>
          )}
        </Pressable>
      </View>
      {pickerVisible && (
        <View style={styles.pickerOverlay}>
          <Pressable
            onPress={() => setPickerVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.pickerPanel,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {isDeleteReview ? "选择差评所在订单" : "选择订单"}
              </Text>
              <Pressable onPress={() => setPickerVisible(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            {sourceLoading ? (
              <ActivityIndicator color="#ff3158" style={{ margin: 32 }} />
            ) : (
              <ScrollView style={styles.pickerList}>
                {sources.map((source, index) => (
                  <Pressable
                    key={`${source.orderId}-${source.reviewId}-${index}`}
                    onPress={() => void chooseSource(source)}
                    style={styles.sourceRow}
                  >
                    <View style={styles.radio}>
                      {selectedSource?.orderId === source.orderId && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <View style={styles.sourceRowText}>
                      <Text style={styles.sourceName}>
                        {source.companionNickname ||
                          source.defendantNickname ||
                          "订单"}
                      </Text>
                      <Text style={styles.sourceSub}>
                        {source.gameName || "游戏订单"} ·{" "}
                        {source.orderNo || source.orderId} ·{" "}
                        {formatTime(source.createdAt)}
                      </Text>
                      {!!source.reviewContent && (
                        <Text numberOfLines={2} style={styles.sourceSub}>
                          {source.reviewContent}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {!sourceLoading && !sources.length && (
              <Text style={styles.empty}>暂无可选订单</Text>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function validMode(value?: string): Mode {
  return value === "ticket" || value === "evidence" || value === "appeal"
    ? value
    : "court";
}
function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.requiredLabel}>
        {required && <Text style={styles.asterisk}>* </Text>}
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f7f7f7", flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  back: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  backText: { color: "#111", fontSize: 32, lineHeight: 34 },
  headerTitle: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  content: { paddingBottom: 16 },
  requiredLabel: {
    color: "#202020",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  asterisk: { color: "#ff3158" },
  typeCards: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  typeCard: {
    backgroundColor: "#fff",
    borderColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  typeCardSelected: { backgroundColor: "#fff6f7", borderColor: "#ff3158" },
  typeTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  typeTitleSelected: { color: "#ff3158" },
  typeDescription: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#f1f1f1",
    borderColor: "#f1f1f1",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 13,
    width: "48%",
  },
  chipSelected: { backgroundColor: "#fff1f3", borderColor: "#ffc6d0" },
  chipText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 12 },
  chipTextSelected: { color: "#ff3158" },
  field: {
    backgroundColor: "#fff",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 12,
  },
  selector: {
    alignItems: "center",
    borderBottomColor: "#f1f1f1",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    minHeight: 36,
  },
  selectorText: {
    color: "#222",
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
  },
  placeholder: { color: "#aaa" },
  chevron: { color: "#aaa", fontSize: 22 },
  input: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  textArea: { minHeight: 106, lineHeight: 20, paddingTop: 12 },
  counter: {
    color: "#aaa",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    textAlign: "right",
  },
  sourceInfo: {
    alignItems: "center",
    backgroundColor: "#fafafa",
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
  },
  sourceAvatar: {
    backgroundColor: "#eee",
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  sourceText: { flex: 1, marginLeft: 9 },
  sourceName: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "600",
  },
  sourceSub: {
    color: "#888",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  targetSearch: { alignItems: "center", flexDirection: "row", marginTop: 8 },
  targetInput: {
    color: "#222",
    flex: 1,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    height: 40,
  },
  findButton: { alignItems: "center", justifyContent: "center", minWidth: 44 },
  findText: { color: "#ff3158", fontFamily: DOUYIN_SANS, fontSize: 12 },
  targetPicked: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  targetAvatar: {
    backgroundColor: "#eee",
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  targetCandidate: {
    alignItems: "center",
    borderTopColor: "#eee",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  uploadSection: { backgroundColor: "#fff", marginTop: 8, padding: 12 },
  uploadHeading: { alignItems: "baseline", flexDirection: "row", gap: 5 },
  images: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  imageWrap: { height: 62, position: "relative", width: 62 },
  image: { borderRadius: 6, height: 62, width: 62 },
  addImage: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  addText: { color: "#aaa", fontSize: 28, lineHeight: 32 },
  removeImage: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.6)",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    top: -4,
    width: 20,
  },
  removeText: { color: "#fff", fontSize: 16, lineHeight: 18 },
  uploaded: {
    alignItems: "center",
    backgroundColor: "#16a67a",
    borderRadius: 8,
    bottom: 2,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 16,
  },
  uploadedText: { color: "#fff", fontSize: 10 },
  agreement: {
    alignItems: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#ccc",
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  checkboxChecked: { backgroundColor: "#ff3158", borderColor: "#ff3158" },
  check: { color: "#fff", fontSize: 10, lineHeight: 12 },
  agreementText: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 11 },
  agreementLink: { color: "#168ff0" },
  detailBanner: { backgroundColor: "#fff", marginTop: 8, padding: 12 },
  detailBannerTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  detailBannerBody: {
    color: "#777",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  rejection: {
    backgroundColor: "#fff5f5",
    color: "#e73d53",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    margin: 12,
    padding: 10,
  },
  footer: {
    backgroundColor: "#fff",
    borderTopColor: "#eee",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  cancel: {
    alignItems: "center",
    borderColor: "#ddd",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  cancelText: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 13 },
  submit: {
    alignItems: "center",
    backgroundColor: "#ff3158",
    borderRadius: 6,
    flex: 2,
    justifyContent: "center",
    minHeight: 42,
  },
  submitText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,.34)",
    justifyContent: "flex-end",
  },
  pickerPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "78%",
    paddingHorizontal: 14,
  },
  pickerHeader: {
    alignItems: "center",
    borderBottomColor: "#eee",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  pickerTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
  close: { color: "#888", fontSize: 24 },
  pickerList: { flexGrow: 0 },
  sourceRow: {
    alignItems: "center",
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  radio: {
    alignItems: "center",
    borderColor: "#bbb",
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDot: {
    backgroundColor: "#ff3158",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  sourceRowText: { flex: 1 },
  empty: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    paddingVertical: 28,
    textAlign: "center",
  },
});
