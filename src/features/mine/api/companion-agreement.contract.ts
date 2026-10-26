import { protocolHtmlToText } from "../protocol-text.ts";

export type CompanionAgreement = {
  id: number;
  code: string;
  title: string;
  version: string;
  content: string;
};
export type AgreementStatus = {
  accepted: boolean;
  protocol: CompanionAgreement | null;
};
type Requester = <T>(
  path: string,
  options: {
    method: "POST";
    token: string;
    body: unknown;
    signal?: AbortSignal;
  },
) => Promise<T>;
type Response<T> = { code: string; info?: string; data?: T | null };
const code = "user_playmate";

export function createCompanionAgreementApi(request: Requester) {
  return {
    async status(
      token: string,
      signal?: AbortSignal,
    ): Promise<AgreementStatus> {
      if (!token) throw new Error("请先登录");
      const response = await request<Response<AgreementStatus>>(
        "/client/v1/protocol/getAcceptanceStatus",
        { method: "POST", token, body: { code }, signal },
      );
      if (response.code !== "SUCCESS" || !response.data) {
        throw new Error(response.info || "协议加载失败，请重试");
      }
      if (response.data.accepted === true)
        return { accepted: true, protocol: null };
      const protocol = response.data.protocol;
      const content = protocolHtmlToText(protocol?.content ?? "");
      if (
        !protocol?.id ||
        protocol.code !== code ||
        !protocol.version ||
        !content
      ) {
        throw new Error("协议暂未发布，请稍后重试");
      }
      return { accepted: false, protocol: { ...protocol, content } };
    },
    async accept(token: string, protocol: CompanionAgreement): Promise<void> {
      if (!token) throw new Error("请先登录");
      const response = await request<Response<boolean>>(
        "/client/v1/protocol/accept",
        {
          method: "POST",
          token,
          body: {
            code: protocol.code,
            agreementId: protocol.id,
            version: protocol.version,
          },
        },
      );
      if (response.code !== "SUCCESS" || response.data !== true) {
        throw new Error(response.info || "协议确认失败，请重试");
      }
    },
  };
}
