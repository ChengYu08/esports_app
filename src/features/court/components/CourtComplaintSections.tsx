import { ChevronRight16Regular } from "@fluentui/react-native-icons";
import { CourtSelectedReviewCard } from "@/features/court/components/CourtSelectedReviewCard";
import { complaintStyles } from "@/features/court/complaint.styles";
import { CachedImage } from "@/shared/ui/CachedImage";
import type { CourtCaseType, CourtSource, TicketTarget } from "@/features/court/court.api";
import { TICKET_REASONS } from "@/features/court/court-ticket";
import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

const CASE_TYPES: { code: CourtCaseType; label: string }[] = [
  { code: "DELETE_REVIEW", label: "删除差评" },
  { code: "RETRAIN", label: "重新培训" },
  { code: "APOLOGY", label: "诉求道歉" },
  { code: "FINE", label: "要求罚款" },
];

const TICKET_REASON_ROWS = [
  TICKET_REASONS.slice(0, 3),
  TICKET_REASONS.slice(3),
];

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  const styles = complaintStyles;
  return (
    <View style={styles.field}>
      <FormLabel label={label} required={required} />
      {children}
    </View>
  );
}

export function FormLabel({ label, required }: { label: string; required?: boolean }) {
  const styles = complaintStyles;
  return (
    <Text style={styles.requiredLabel}>
      {required && <Text style={styles.asterisk}>* </Text>}
      {label}
    </Text>
  );
}

export function PublishTypeSection({
  mode,
  expanded,
  disabled,
  onToggle,
  onSelect,
}: {
  mode: "court" | "ticket";
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onSelect: (mode: "court" | "ticket") => void;
}) {
  const styles = complaintStyles;
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="发布类型"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.sectionHeading}
      >
        <FormLabel label="发布类型" required />
        <CachedImage
          source={require("../../../../assets/court/ticket-arrow-up.svg")}
          style={[styles.collapseIcon, !expanded && styles.collapsedIcon]}
        />
      </Pressable>
      {expanded && (
        <View style={styles.typeCards}>
          {(["court", "ticket"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === value }}
              disabled={disabled}
              onPress={() => onSelect(value)}
              style={[styles.typeCard, mode === value && styles.typeCardSelected]}
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
                  ? "小法庭大众评审适用于对服务不满意，善于表达的用户，处理时间相对较长"
                  : "适用于对平台功能不满意，发生其他纠纷的老板，客服响应快，处理时间相对较短"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function CourtCaseFormSection({
  caseType,
  selectedSource,
  sourceLabel,
  claim,
  disabled,
  onSelectCaseType,
  onOpenSources,
  onChangeClaim,
}: {
  caseType: CourtCaseType;
  selectedSource: CourtSource | null;
  sourceLabel: string;
  claim: string;
  disabled: boolean;
  onSelectCaseType: (caseType: CourtCaseType) => void;
  onOpenSources: () => void;
  onChangeClaim: (claim: string) => void;
}) {
  const styles = complaintStyles;
  const isDeleteReview = caseType === "DELETE_REVIEW";
  return (
    <>
      <View style={styles.section}>
        <FormLabel label="诉求类型" required />
        <View style={styles.chips}>
          {CASE_TYPES.map((item) => (
            <Pressable
              key={item.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: caseType === item.code }}
              disabled={disabled}
              onPress={() => onSelectCaseType(item.code)}
              style={[styles.chip, caseType === item.code && styles.chipSelected]}
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
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onOpenSources}
        style={styles.selectorField}
      >
        <FormLabel
          label={isDeleteReview ? "需删除的订单差评" : "需处理订单信息"}
          required
        />
        <View style={styles.selector}>
          <Text
            numberOfLines={1}
            style={[styles.selectorText, !selectedSource && styles.placeholder]}
          >
            {sourceLabel}
          </Text>
          <View style={styles.chevronIcon}>
            <View style={styles.chevronMark} />
          </View>
        </View>
      </Pressable>
      {selectedSource && (isDeleteReview ? (
        <CourtSelectedReviewCard source={selectedSource} disabled={disabled} />
      ) : (
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
      ))}
      <FormField label="个人诉求" required>
        <TextInput
          value={claim}
          onChangeText={onChangeClaim}
          maxLength={50}
          multiline
          textAlignVertical="top"
          editable={!disabled}
          placeholder="请输入个人诉求"
          placeholderTextColor="#CCCCCC"
          style={styles.input}
        />
        <Text style={styles.counter}>{claim.length}/50</Text>
      </FormField>
    </>
  );
}

export function TicketFormSection({
  reason,
  target,
  expanded,
  disabled,
  onToggle,
  onSelectReason,
  onOpenTargets,
}: {
  reason: string;
  target: TicketTarget | null;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onSelectReason: (reason: string) => void;
  onOpenTargets: () => void;
}) {
  const styles = complaintStyles;
  return (
    <>
      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="诉求类型"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.sectionHeading}
        >
          <FormLabel label="诉求类型" required />
          <CachedImage
            source={require("../../../../assets/court/ticket-arrow-up.svg")}
            style={[styles.collapseIcon, !expanded && styles.collapsedIcon]}
          />
        </Pressable>
        {expanded && (
          <View style={styles.ticketReasonRows}>
            {TICKET_REASON_ROWS.map((row) => (
              <View key={row[0][0]} style={styles.ticketReasonRow}>
                {row.map(([code, label]) => (
                  <Pressable
                    key={code}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: reason === code }}
                    disabled={disabled}
                    onPress={() => onSelectReason(code)}
                    style={[
                      styles.ticketReasonOption,
                      reason === code && styles.ticketReasonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        reason === code && styles.chipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
                {row.length < 3 && (
                  <View style={styles.ticketReasonPlaceholder} />
                )}
              </View>
            ))}
          </View>
        )}
      </View>
      {reason !== "PLATFORM_SUGGESTION" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            target
              ? `诉告对象：${target.nickname}，点击修改`
              : "选择诉告对象"
          }
          disabled={disabled}
          onPress={onOpenTargets}
          style={styles.targetField}
        >
          <FormLabel label="诉告对象" required />
          <View style={styles.targetValue}>
            {target && (
              <CachedImage
                source={
                  target.headImage
                    ? { uri: target.headImage }
                    : require("../../../../assets/coms/avatar_default.webp")
                }
                style={styles.targetAvatar}
              />
            )}
            <Text
              numberOfLines={1}
              style={[styles.targetName, !target && styles.placeholder]}
            >
              {target?.nickname || "请选择"}
            </Text>
            <ChevronRight16Regular color="#999999" width={18} height={18} style={styles.targetArrow} />
          </View>
        </Pressable>
      )}
    </>
  );
}
