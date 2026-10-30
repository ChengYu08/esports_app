import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { showToast } from "@/shared/ui/app-toast";

import {
  createCustomerServiceChatParams,
  enterCustomerService,
  resolveCustomerServiceError,
} from "@/features/message/customer-service.api";
import { messageStore } from "@/features/message/message-store";
import { requireLogin } from "@/shared/navigation/require-login";

export function useCustomerServiceEntry() {
  const [entering, setEntering] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const openCustomerService = async () => {
    if (pending.current || !requireLogin()) {
      return;
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      return;
    }
    pending.current = true;
    setEntering(true);
    try {
      const session = await enterCustomerService(token);
      if (!mounted.current || useAuthStore.getState().accessToken !== token) {
        return;
      }
      const targetId = String(session.imTargetId ?? session.agentUserId ?? "").trim();
      const conversation = messageStore.getState().conversations.find((item) => item.id === targetId);
      router.push({
        pathname: "/chat/[id]",
        params: createCustomerServiceChatParams(session, conversation?.title),
      });
    } catch (error) {
      if (mounted.current && useAuthStore.getState().accessToken === token) {
        showToast(resolveCustomerServiceError(error));
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        setEntering(false);
      }
    }
  };

  return { entering, openCustomerService };
}
