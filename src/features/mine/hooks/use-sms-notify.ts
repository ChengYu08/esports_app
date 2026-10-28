import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@esports/auth";

import {
  fetchSmsNotifyStatus,
  updateSmsNotifySwitch,
} from "@/features/mine/api/notification-settings.api";

/** 短信通知开关查询缓存键，基础设置页与消息通知页共享同一份缓存。 */
export function smsNotifyStatusQueryKey(token?: string | null) {
  return ["sms-notify-status", token] as const;
}

/**
 * 查询短信通知开关。
 * 基础设置页（消息通知入口页）挂载时即拉取预热缓存，
 * 消息通知页进入时命中缓存直接渲染，避免出现二次加载的刷新效果。
 */
export function useSmsNotifyStatus() {
  const token = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: smsNotifyStatusQueryKey(token),
    queryFn: ({ signal }) => fetchSmsNotifyStatus(token as string, signal),
    enabled: Boolean(token),
  });
}

/** 保存短信通知开关，成功后同步本地缓存，两个页面状态立即一致。 */
export function useUpdateSmsNotify() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);

  return useMutation({
    mutationFn: (enabled: boolean) =>
      updateSmsNotifySwitch(token as string, enabled),
    onSuccess: (_data, enabled) => {
      queryClient.setQueryData(smsNotifyStatusQueryKey(token), enabled ? 1 : 0);
    },
  });
}
