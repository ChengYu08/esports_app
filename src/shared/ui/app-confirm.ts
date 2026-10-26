import { create } from "zustand";

export type AppConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type AppConfirmState = {
  options: AppConfirmOptions | null;
  confirm: (options: AppConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
};

let resolveCurrent: ((confirmed: boolean) => void) | null = null;

export const useAppConfirm = create<AppConfirmState>((set) => ({
  options: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      resolveCurrent?.(false);
      resolveCurrent = resolve;
      set({ options });
    }),
  settle: (confirmed) => {
    resolveCurrent?.(confirmed);
    resolveCurrent = null;
    set({ options: null });
  },
}));
