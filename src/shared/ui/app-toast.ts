import Toast from "react-native-root-toast";

import type { ToastOptions } from "react-native-root-toast";

export const toastDurations = Toast.durations;

export function showToast(message: string, options?: ToastOptions) {
  return Toast.show(message, {
    duration: Toast.durations.SHORT,
    position: Toast.positions.CENTER,
    ...options,
  });
}
