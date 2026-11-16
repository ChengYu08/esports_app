import Toast from "react-native-root-toast";

import type { ToastOptions } from "react-native-root-toast";
import { create } from "zustand";

export const toastDurations = Toast.durations;

export function getToastOptions(options?: ToastOptions): ToastOptions {
  return {
    duration: Toast.durations.SHORT,
    position: Toast.positions.CENTER,
    ...options,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    opacity: 1,
    shadow: false,
  };
}

export function showToast(message: string, options?: ToastOptions) {
  return Toast.show(message, getToastOptions(options));
}

type GlobalToast = { id: number; message: string; options: ToastOptions };

export const useGlobalToast = create<{ toast: GlobalToast | null }>(() => ({
  toast: null,
}));

let nextToastId = 0;

/** 成功后需要关闭弹窗或切换页面时，交由根布局展示，避免随原页面一起卸载。 */
export function showGlobalToast(message: string, options?: ToastOptions) {
  useGlobalToast.setState({
    toast: {
      id: ++nextToastId,
      message,
      options: getToastOptions({ duration: toastDurations.LONG, ...options }),
    },
  });
}

export function clearGlobalToast(id: number) {
  if (useGlobalToast.getState().toast?.id === id) {
    useGlobalToast.setState({ toast: null });
  }
}
