const COMPANION_REAL_NAME_REQUIRED_MESSAGE = "陪玩未进行实名认证";

/** 老板本人未实名（后端 BussinessException 的 info 精确文案，须与「陪玩未进行实名认证」区分） */
const SELF_REAL_NAME_REQUIRED_MESSAGE = "未进行实名认证";

export function requiresRealNameVerification(message: string) {
  return message.includes(COMPANION_REAL_NAME_REQUIRED_MESSAGE);
}

export function requiresSelfRealNameVerification(message: string) {
  return message === SELF_REAL_NAME_REQUIRED_MESSAGE;
}

export function handleOrderFailurePromptConfirm(
  message: string,
  actions: {
    dismissPrompt: () => void;
    dismissSheet: (afterClose?: () => void) => void;
    openVerification: () => void;
    openSelfVerification: () => void;
  },
) {
  actions.dismissPrompt();
  if (requiresSelfRealNameVerification(message)) {
    actions.dismissSheet(actions.openSelfVerification);
    return;
  }
  if (requiresRealNameVerification(message)) {
    actions.dismissSheet(actions.openVerification);
  }
}
