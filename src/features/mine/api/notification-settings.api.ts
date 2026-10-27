import { apiClient } from "@/core/network/api-client";

/** 查询短信通知开关，1 开启 / 0 关闭。 */
export async function fetchSmsNotifyStatus(token: string): Promise<0 | 1> {
  return apiClient<0 | 1>("/client/v1/smsNotify/status", { token });
}

/** 保存短信通知开关。 */
export async function updateSmsNotifySwitch(
  token: string,
  enabled: boolean,
): Promise<void> {
  await apiClient<unknown>("/client/v1/smsNotify/switch", {
    token,
    method: "POST",
    body: { enabled: enabled ? 1 : 0 },
  });
}
