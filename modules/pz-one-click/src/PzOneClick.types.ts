export type PzOneClickModuleEvents = {
  onStateChange: (params: StateChangePayload) => void;
};

export type QuickLoginAuthToken = {
  jwtToken: string;
  accessToken: string;
};

export type QuickLoginResult = {
  spToken: string;
  phone?: string;
};

export type StateChangePayload = { state: "checking" | "authorizing" | "cancelled" | "unavailable" };
