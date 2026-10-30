import { TICKET_REASONS } from "@/features/court/court-ticket";
import type { CourtCase, PlatformTicket } from "@/features/court/court.api";
import { courtApi } from "@/features/court/court.api";
import { useEffect, useRef, useState } from "react";
import { showToast } from "@/shared/ui/app-toast";

export function toUploadItems(evidence?: Record<string, string>) {
  return Object.entries(evidence ?? {}).map(([key, uri], index) => ({
    uri,
    name: `retained-${index}`,
    key,
    retained: true,
  }));
}

// 加载可重新提交的评审案件（重新提交 / 申诉 / 补充举证共用），
// 加载成功后通过 onLoaded 回填表单。
export function useCaseDetail(caseId: string | undefined, onLoaded: (item: CourtCase) => void) {
  const [detail, setDetail] = useState<CourtCase | null>(null);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    if (!caseId) {
      return;
    }
    let active = true;
    courtApi
      .getDetail(caseId, true)
      .then((item) => {
        if (!active) return;
        if (caseId && !item.actions?.includes("RESUBMIT"))
          throw new Error("案件当前不可重新提交");
        setDetail(item);
        onLoadedRef.current(item);
      })
      .catch((error) =>
        showToast(error instanceof Error ? error.message : "案件加载失败"),
      );
    return () => {
      active = false;
    };
  }, [caseId]);

  return detail;
}

// 加载可重新提交的被驳回工单，带 loading / error / retry，
// 加载成功后通过 onLoaded 回填表单。
export function useTicketDetail(ticketId: string | undefined, onLoaded: (item: PlatformTicket) => void) {
  const [detail, setDetail] = useState<PlatformTicket | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const item = await courtApi.getTicketDetail(ticketId, true);
        if (!active) {
          return;
        }
        if (item.status !== "REJECTED") {
          throw new Error("工单当前不可重新提交");
        }
        if (!TICKET_REASONS.some(([code]) => code === item.reasonType)) {
          throw new Error("工单诉求类型无效，请返回重试");
        }
        setDetail(item);
        onLoadedRef.current(item);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "工单加载失败");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ticketId, attempt]);

  return {
    detail,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
