import type { RCIMIWEngine, RCIMIWMessage } from "@rongcloud/react-native-im-wrapper";

/** SDK 返回码只表示是否受理；回调才是发送结果。两条错误路径都必须结束等待。 */
export function sendRongMessage(
  engine: Pick<RCIMIWEngine, "sendMessage">,
  message: RCIMIWMessage,
  errorTitle = "发送消息失败",
): Promise<RCIMIWMessage> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, sent?: RCIMIWMessage) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else if (sent) {
        resolve(sent);
      } else {
        reject(new Error(errorTitle));
      }
    };
    const timer = setTimeout(() => {
      // 超时不自动重发，避免网络恢复后重复发送。
      finish(new Error("发送超时，请检查网络并确认消息是否已送达"));
    }, 30_000);
    Promise.resolve().then(() => engine.sendMessage(message, {
      onMessageSent: (code, sent) => {
        finish(code === 0 ? undefined : new Error(`${errorTitle}（${code}）`), sent);
      },
    })).then((code) => {
      if (code !== 0) {
        finish(new Error(`${errorTitle}（${code}）`));
      }
    }).catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error(errorTitle));
    });
  });
}
