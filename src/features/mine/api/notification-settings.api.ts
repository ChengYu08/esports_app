import { apiClient } from "@/core/network/api-client";

/** 后端 R 包络：code === "SUCCESS" 表示业务成功，数据在 data 字段。 */
type ApiEnvelope<T> = {
  code?: string;
  info?: string;
  data?: T;
};

/** 查询短信通知开关，1 开启 / 0 关闭。 */
export async function fetchSmsNotifyStatus(
  token: string,
  signal?: AbortSignal,
): Promise<0 | 1> {
  const response = await apiClient<ApiEnvelope<0 | 1>>(
    "/client/v1/smsNotify/status",
    { token, signal },
  );
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "短信通知设置加载失败");
  }
  return response.data ?? 0;
}

/** 保存短信通知开关。 */
export async function updateSmsNotifySwitch(
  token: string,
  enabled: boolean,
): Promise<void> {
  const response = await apiClient<ApiEnvelope<unknown>>(
    "/client/v1/smsNotify/switch",
    {
      token,
      method: "POST",
      body: { enabled: enabled ? 1 : 0 },
    },
  );
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "短信通知设置保存失败");
  }
}
