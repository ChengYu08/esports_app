import { AppPrompt } from "@/shared/ui/AppPrompt";
import { useAppConfirm } from "@/shared/ui/app-confirm";

export function AppConfirmHost() {
  const options = useAppConfirm((state) => state.options);
  const settle = useAppConfirm((state) => state.settle);

  return (
    <AppPrompt
      visible={Boolean(options)}
      title={options?.title}
      message={options?.message ?? ""}
      cancelText={options?.cancelText}
      confirmText={options?.confirmText}
      onCancel={options?.cancelText ? () => settle(false) : undefined}
      onConfirm={() => settle(true)}
    />
  );
}
