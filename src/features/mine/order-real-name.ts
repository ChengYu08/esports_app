const COMPANION_REAL_NAME_REQUIRED_MESSAGE = "陪玩未进行实名认证";

export function requiresRealNameVerification(message: string) {
  return message.includes(COMPANION_REAL_NAME_REQUIRED_MESSAGE);
}

export function handleOrderFailurePromptConfirm(
  message: string,
  actions: {
    dismissPrompt: () => void;
    dismissSheet: (afterClose?: () => void) => void;
    openVerification: () => void;
  },
) {
  actions.dismissPrompt();
  if (requiresRealNameVerification(message)) {
    actions.dismissSheet(actions.openVerification);
  }
}
