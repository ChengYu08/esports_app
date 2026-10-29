/** 青少年模式状态（服务端 YouthModeStatusVO）。 */
export type TeenModeStatus = {
  enabled: boolean;
  passwordSet: boolean;
  remainingAttempts: number;
};

/** 后端 R 包络（这组接口为数字 code 形态）。 */
export type TeenResponse<T> = {
  code: number | string;
  msg?: string;
  data?: T;
};

export type TeenRequester = <T>(
  path: string,
  options: { method: "POST"; token?: string; body?: unknown },
) => Promise<TeenResponse<T>>;

function unwrap<T>(response: TeenResponse<T>): T {
  // 实测（2026-10-29 抓包）code 为字符串 "SUCCESS"（后端文档写数字 0 有误），两种形态都容错
  const success = response?.code === "SUCCESS" || Number(response?.code) === 0;
  if (!success) {
    throw new Error(response?.msg || "请求失败，请稍后重试");
  }
  if (response.data === undefined || response.data === null) {
    throw new Error("响应数据缺失，请稍后重试");
  }
  return response.data;
}

export function createTeenModeApi(requester: TeenRequester) {
  return {
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

