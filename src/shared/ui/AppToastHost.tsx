import { RootSiblingPortal } from "react-native-root-siblings";
import { ToastContainer } from "react-native-root-toast";

import { clearGlobalToast, useGlobalToast } from "./app-toast";

/** 始终挂载在根布局，Portal 在弹窗出现前绑定应用级容器。 */
export function AppToastHost() {
  const toast = useGlobalToast((state) => state.toast);

  return (
    <RootSiblingPortal>
      {toast ? (
        <ToastContainer
          key={toast.id}
          {...toast.options}
          visible
          onHidden={() => {
            clearGlobalToast(toast.id);
            toast.options.onHidden?.();
          }}
        >
          {toast.message}
        </ToastContainer>
      ) : null}
    </RootSiblingPortal>
  );
}
