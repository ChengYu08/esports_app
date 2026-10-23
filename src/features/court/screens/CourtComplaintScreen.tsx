import {
  toUploadItems,
  useCaseDetail,
  useTicketDetail,
} from "@/features/court/complaint-hooks";
import { complaintStyles as styles } from "@/features/court/complaint.styles";
import {
  CourtCaseFormSection,
  FormField,
  PublishTypeSection,
  TicketFormSection,
} from "@/features/court/components/CourtComplaintSections";
import {
  CourtEvidencePicker,
  useEvidenceImages,
} from "@/features/court/components/CourtEvidencePicker";
import { useCourtSourceSelection } from "@/features/court/court-source-selection";
import { useCourtTargetSelection } from "@/features/court/court-target-selection";
import {
  createTicketSubmitter,
  ticketDraftError,
  ticketInput,
} from "@/features/court/court-ticket";
import {
  courtApi,
  makeIdempotencyKey,
  type CourtCaseType,
  type CourtSource,
  type TicketTarget,
} from "@/features/court/court.api";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Mode = "court" | "ticket" | "evidence" | "appeal";

function validMode(value?: string): Mode {
  return value === "ticket" || value === "evidence" || value === "appeal"
    ? value
    : "court";
}

export default function CourtComplaintScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    caseId?: string;
    ticketId?: string;
    targetUid?: string;
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [mode, setMode] = useState<Mode>(() =>
    params.ticketId ? "ticket" : validMode(params.mode),
  );
  const [caseType, setCaseType] = useState<CourtCaseType>("DELETE_REVIEW");
  const [publishTypeExpanded, setPublishTypeExpanded] = useState(true);
  const [ticketReasonExpanded, setTicketReasonExpanded] = useState(true);
  const [ticketReason, setTicketReason] = useState<string>("RULE_VIOLATION");
  const [claim, setClaim] = useState("");
  const [content, setContent] = useState("");
  const [sourceSessionId] = useState(() => makeIdempotencyKey("court-source"));
  const [targetSessionId] = useState(() => makeIdempotencyKey("ticket-target"));
  const [submitTicket] = useState(createTicketSubmitter);
  const submissionRef = useRef(false);
  const mountedRef = useRef(true);
  const [selectedSource, setSelectedSource] = useState<CourtSource | null>(
    null,
  );
  const [agree, setAgree] = useState(false);
  const [target, setTarget] = useState<TicketTarget | null>(() =>
    params.targetUid
      ? { id: params.targetUid, nickname: `用户 ${params.targetUid}` }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const evidence = useEvidenceImages(accessToken, checkAccount);
  const {
    images,
    setImages,
    pickingImages,
    pickImages,
    removeImage,
    uploadAll,
  } = evidence;
  const caseDetail = useCaseDetail(params.caseId, (item) => {
    if (item.content) setContent(item.content);
    if (item.claim) setClaim(item.claim);
    if (item.caseType) setCaseType(item.caseType as CourtCaseType);
    if (item.sourceOrderId || item.sourceReviewId)
      setSelectedSource({
        orderId: item.sourceOrderId,
        reviewId: item.sourceReviewId,
        orderNo: item.orderNo,
        companionNickname: item.companionNickname,
        companionAvatar: item.companionAvatar,
      });
    setImages(toUploadItems(item.editableEvidence));
  });
  const ticket = useTicketDetail(params.ticketId, (item) => {
    setTicketReason(item.reasonType!);
    setContent(item.content ?? "");
    setTarget(
      item.targetUid && item.reasonType !== "PLATFORM_SUGGESTION"
        ? {
            id: String(item.targetUid),
            nickname: item.targetNickname || `用户 ${item.targetUid}`,
            headImage: item.targetAvatar,
          }
        : null,
    );
    setImages(toUploadItems(item.editableEvidence));
  });
  const formDisabled =
    submitting ||
    pickingImages ||
    (mode === "ticket" && (ticket.loading || !!ticket.error));
  const isDeleteReview = caseType === "DELETE_REVIEW";
  const ticketDraft = {
    reasonType: ticketReason,
    target,
    content,
    agreed: agree,
  };
  const canSubmit =
    !formDisabled &&
    Boolean(content.trim()) &&
    (mode === "court"
      ? Boolean(
          (isDeleteReview
            ? selectedSource?.reviewId
            : selectedSource?.orderId) &&
          claim.trim() &&
          agree,
        )
      : mode === "ticket"
        ? !ticketDraftError(ticketDraft)
        : Boolean(params.caseId));
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

  function checkAccount() {
    if (!mountedRef.current) {
      throw new Error("表单已关闭");
    }
    if (!accessToken || useAuthStore.getState().accessToken !== accessToken) {
      throw new Error("登录状态已变化，请重新登录后提交");
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sourceLabel = useMemo(() => {
    if (!selectedSource) return "请选择";
    return `${isDeleteReview ? "差评订单" : "订单"} ${selectedSource.orderNo || selectedSource.orderId || ""}`;
  }, [isDeleteReview, selectedSource]);

  useEffect(
    () => () => {
      useCourtSourceSelection.getState().remove(sourceSessionId);
      useCourtTargetSelection.getState().remove(targetSessionId);
    },
    [sourceSessionId, targetSessionId],
  );

  useFocusEffect(
    useCallback(() => {
      const selection =
        useCourtTargetSelection.getState().sessions[targetSessionId];
      if (
        !selection?.confirmedTarget ||
        selection.ownerToken !== accessToken ||
        mode !== "ticket" ||
        ticketReason === "PLATFORM_SUGGESTION"
      ) {
        return;
      }
      const timer = setTimeout(() => {
        setTarget(selection.confirmedTarget);
        useCourtTargetSelection.getState().remove(targetSessionId);
      }, 0);
      return () => clearTimeout(timer);
    }, [accessToken, mode, targetSessionId, ticketReason]),
  );

  useFocusEffect(
    useCallback(() => {
      const selection =
        useCourtSourceSelection.getState().sessions[sourceSessionId];
      if (
        !selection?.confirmedSource ||
        selection.caseType !== caseType ||
        selection.ownerToken !== accessToken
      ) {
        return;
      }
      const timer = setTimeout(() => {
        setSelectedSource(selection.confirmedSource);
        useCourtSourceSelection.getState().remove(sourceSessionId);
      }, 0);
      return () => clearTimeout(timer);
    }, [accessToken, caseType, sourceSessionId]),
  );

  function openTargets() {
    if (formDisabled) {
      return;
    }
    if (!accessToken) {
      router.push("/login");
      return;
    }
    useCourtTargetSelection
      .getState()
      .begin(targetSessionId, accessToken, target);
    router.push({
      pathname: "/court/select-target",
      params: { sessionId: targetSessionId },
    });
  }

  function openSources() {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    useCourtSourceSelection
      .getState()
      .begin(sourceSessionId, caseType, accessToken, selectedSource);
    router.push({
      pathname: "/court/select-order",
      params: { sessionId: sourceSessionId },
    });
  }

  async function submit() {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    if (formDisabled || submissionRef.current) {
      return;
    }
    if (!content.trim()) {
      Toast.show("请填写投诉内容", { duration: Toast.durations.SHORT });
      return;
    }
    if (
      mode === "court" &&
      (!caseType || !selectedSource || !claim.trim() || !agree)
    ) {
      Toast.show("请完整填写评审信息并同意使用守则", {
        duration: Toast.durations.SHORT,
      });
      return;
    }
    if (mode === "ticket") {
      const error = ticketDraftError(ticketDraft);
      if (error) {
        Toast.show(error, {
          duration: Toast.durations.SHORT,
          position: Toast.positions.CENTER,
        });
        return;
      }
    }
    if ((mode === "appeal" || mode === "evidence") && !params.caseId) {
      Toast.show("案件信息缺失", { duration: Toast.durations.SHORT });
      return;
    }
    submissionRef.current = true;
    setSubmitting(true);
    try {
      checkAccount();
      const keys = await uploadAll((image) =>
        courtApi.uploadEvidence(image.uri, image.name),
      );
      checkAccount();
      if (mode === "court") {
        const retainedKeys = images
          .filter((image) => image.retained && image.key)
          .map((image) => image.key as string);
        const input = {
          caseType: caseType as CourtCaseType,
          orderId: isDeleteReview ? undefined : selectedSource?.orderId,
          reviewId: isDeleteReview ? selectedSource?.reviewId : undefined,
          claim: claim.trim(),
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
        const input = ticketInput(
          ticketDraft,
          params.ticketId
            ? keys.filter((key) => !retainedKeys.includes(key))
            : keys,
        );
        await submitTicket(input, params.ticketId, retainedKeys);
      } else if (mode === "evidence") {
        await courtApi.supplementEvidence(params.caseId!, keys, content.trim());
      } else {
        await courtApi.appeal(params.caseId!, content.trim(), keys);
      }
      checkAccount();
      if (mode === "ticket") {
        router.dismissTo({
          pathname: "/(tabs)",
          params: { ticketSubmitted: "1" },
        });
      } else {
        Toast.show("提交成功", {
          duration: Toast.durations.SHORT,
          position: Toast.positions.CENTER,
        });
        router.back();
      }
    } catch (error) {
      if (mountedRef.current) {
        Toast.show(error instanceof Error ? error.message : "提交失败", {
          duration: Toast.durations.SHORT,
          position: Toast.positions.CENTER,
        });
      }
    } finally {
      submissionRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
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
          { paddingTop: insets.top, height: insets.top + 44 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          disabled={submitting}
          onPress={() => router.back()}
          style={styles.back}
        >
          <CachedImage
            source={require("../../../../assets/home/club-detail/icon-back.svg")}
            tintColor="#0D0D0F"
            style={styles.backIcon}
          />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {mode === "ticket" && ticket.loading && (
          <View style={styles.loadState}>
            <ActivityIndicator color="#FE1F4C" />
            <Text style={styles.loadError}>正在加载原工单…</Text>
          </View>
        )}
        {mode === "ticket" && !!ticket.error && (
          <View style={styles.loadState}>
            <Text style={styles.loadError}>{ticket.error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={ticket.retry}
              style={styles.retry}
            >
              <Text style={styles.retryText}>重新加载</Text>
            </Pressable>
          </View>
        )}
        {(mode === "court" || mode === "ticket") && (
          <>
            {!params.caseId && !params.ticketId && (
              <PublishTypeSection
                mode={mode}
                expanded={publishTypeExpanded}
                disabled={formDisabled}
                onToggle={() => setPublishTypeExpanded((expanded) => !expanded)}
                onSelect={setMode}
              />
            )}
            {mode === "court" ? (
              <CourtCaseFormSection
                caseType={caseType}
                selectedSource={selectedSource}
                sourceLabel={sourceLabel}
                claim={claim}
                disabled={formDisabled}
                onSelectCaseType={(value) => {
                  setCaseType(value);
                  setSelectedSource(null);
                }}
                onOpenSources={openSources}
                onChangeClaim={setClaim}
              />
            ) : (
              <TicketFormSection
                reason={ticketReason}
                target={target}
                expanded={ticketReasonExpanded}
                disabled={formDisabled}
                onToggle={() =>
                  setTicketReasonExpanded((expanded) => !expanded)
                }
                onSelectReason={(code) => {
                  setTicketReason(code);
                  if (code === "PLATFORM_SUGGESTION") {
                    setTarget(null);
                    useCourtTargetSelection.getState().remove(targetSessionId);
                  }
                }}
                onOpenTargets={openTargets}
              />
            )}
          </>
        )}

        {(mode === "appeal" || mode === "evidence") && !!caseDetail && (
          <View style={styles.detailBanner}>
            <Text style={styles.detailBannerTitle}>
              {mode === "appeal" ? "申诉案件" : "待补充举证"}
              {caseDetail.caseNo || caseDetail.caseId}
            </Text>
            <Text style={styles.detailBannerBody}>
              {caseDetail.contentSummary || caseDetail.content || ""}
            </Text>
            {mode === "appeal" && !!caseDetail.rejectionReason && (
              <Text style={styles.rejection}>
                驳回原因：{caseDetail.rejectionReason}
              </Text>
            )}
          </View>
        )}
        {mode === "ticket" && ticket.detail?.rejectionReason && (
          <View style={styles.detailBanner}>
            <Text style={styles.detailBannerTitle}>工单驳回原因</Text>
            <Text style={styles.rejection}>
              {ticket.detail.rejectionReason}
            </Text>
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
            editable={!formDisabled}
            maxLength={1000}
            placeholder={
              mode === "evidence"
                ? "请描述证据内容"
                : mode === "appeal"
                  ? "请填写申诉理由"
                  : mode === "court"
                    ? "请描述投诉原因"
                    : "请输入"
            }
            placeholderTextColor="#CCCCCC"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{content.length}/1000</Text>
        </FormField>
        <CourtEvidencePicker
          images={images}
          picking={pickingImages}
          disabled={formDisabled}
          showCount={mode !== "ticket"}
          onPick={pickImages}
          onRemove={removeImage}
        />
        {!!params.caseId &&
          !!caseDetail?.rejectionReason &&
          mode === "court" && (
            <Text style={styles.rejection}>
              驳回原因：{caseDetail.rejectionReason}
            </Text>
          )}
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {(mode === "court" || mode === "ticket") && (
          <View style={styles.agreement}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="我已阅读并同意小法庭用户使用守则"
              accessibilityState={{ checked: agree, disabled: submitting }}
              disabled={formDisabled}
              onPress={() => setAgree((value) => !value)}
              style={styles.agreementToggle}
              hitSlop={4}
            >
              <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                {agree && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.agreementText}>我已阅读并同意</Text>
            </Pressable>
            <Text
              accessibilityRole="link"
              onPress={() =>
                Toast.show("小法庭用户使用守则请关注平台公告", {
                  duration: Toast.durations.LONG,
                  position: Toast.positions.CENTER,
                })
              }
              style={[styles.agreementText, styles.agreementLink]}
            >
              《小法庭用户使用守则》
            </Text>
          </View>
        )}
        <View style={styles.footerButtons}>
          {(mode === "evidence" || mode === "appeal") && (
            <Pressable
              disabled={formDisabled}
              onPress={() => router.back()}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: submitting || !canSubmit,
              busy: submitting,
            }}
            disabled={submitting || !canSubmit}
            onPress={submit}
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>确认提交</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
