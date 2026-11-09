/** 青少年模式状态（服务端 YouthModeStatusVO）。 */
export type TeenModeStatus = {
  enabled: boolean;
  passwordSet: boolean;
  remainingAttempts: number;
  /** 服务端当前时间（epoch 毫秒）：用于校准本地时钟偏移，锁定时段判定以它为准 */
  serverTime?: number;
};

/** 青少年模式锁定时段配置（服务端 YouthModeConfigVO，Nacos 动态下发）。 */
export type TeenModeConfig = {
  /** 锁定是否生效：false 表示时段未配置/非法，锁定解除；客户端不得自行兜底时段 */
  lockEnabled: boolean;
  /** 锁定形态：always 全天 / same-day 本日 / cross-day 跨日；lockEnabled=false 时为空 */
  mode?: "always" | "same-day" | "cross-day";
  /** 锁定时段起始小时（含），北京时间 0-23；lockEnabled=false 或 always 时为空 */
  lockStartHour?: number;
  /** 锁定时段结束小时（不含），北京时间 0-23；lockEnabled=false 或 always 时为空 */
  lockEndHour?: number;
};

/** 后端 R 包络（这组接口为数字 code 形态；失败文案字段实测为 info，msg 做容错兼容）。 */
export type TeenResponse<T> = {
  code: number | string;
  msg?: string;
  info?: string;
  data?: T;
};

export type TeenRequester = <T>(
  path: string,
  options: { method: "POST" | "GET"; token?: string; body?: unknown },
) => Promise<TeenResponse<T>>;

function unwrap<T>(response: TeenResponse<T>): T {
  // 实测（2026-10-29 抓包）code 为字符串 "SUCCESS"（后端文档写数字 0 有误），两种形态都容错；
  // 失败文案在 info 字段（与全局 apiClient 读取口径一致），msg 仅做容错
  const success = response?.code === "SUCCESS" || Number(response?.code) === 0;
  if (!success) {
    throw new Error(response?.info || response?.msg || "请求失败，请稍后重试");
  }
  if (response.data === undefined || response.data === null) {
    throw new Error("响应数据缺失，请稍后重试");
  }
  return response.data;
}

export function createTeenModeApi(requester: TeenRequester) {
  return {
    /** 查询青少年模式锁定时段配置：本地锁定判定、边界定时器与提示文案跟随此配置。 */
    async config(token: string): Promise<TeenModeConfig> {
      return unwrap(
        await requester<TeenModeConfig>("/client/v1/youth/config", {
          method: "GET",
          token,
        }),
      );
    },
    /** 查询青少年模式状态（开启拦截判断的唯一依据）。 */
    async status(token: string): Promise<TeenModeStatus> {
      return unwrap(
        await requester<TeenModeStatus>("/client/v1/youth/status", {
          method: "POST",
          token,
          body: { action: {} },
        }),
      );
    },
    /** 开启青少年模式：未设过密码需同时传 confirmPassword；已设过只需 password。 */
    async open(
      token: string,
      password: string,
      confirmPassword?: string,
    ): Promise<TeenModeStatus> {
      return unwrap(
        await requester<TeenModeStatus>("/client/v1/youth/open", {
          method: "POST",
          token,
          body: {
            action: {
              password,
              ...(confirmPassword !== undefined ? { confirmPassword } : {}),
            },
          },
        }),
      );
    },
    /** 关闭青少年模式：密码错误会消耗当日错误次数（错误信息在 msg）。 */
    async close(token: string, password: string): Promise<TeenModeStatus> {
      return unwrap(
        await requester<TeenModeStatus>("/client/v1/youth/close", {
          method: "POST",
          token,
          body: { action: { password } },
        }),
      );
    },
    /** 设置/修改密码：已有密码时必须传 oldPassword；开启中服务端会拒绝。 */
    async setPassword(
      token: string,
      opts: { oldPassword?: string; password: string; confirmPassword: string },
    ): Promise<TeenModeStatus> {
      return unwrap(
        await requester<TeenModeStatus>("/client/v1/youth/password", {
          method: "POST",
          token,
          body: { action: { ...opts } },
        }),
      );
    },
  };
}

