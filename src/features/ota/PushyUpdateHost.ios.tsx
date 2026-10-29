import { type ReactNode } from "react";

type PushyUpdateHostProps = {
  children: ReactNode;
};

/** iOS 不接入热更新，避免加载依赖 Pushy 原生模块的 JS。 */
export function PushyUpdateHost({ children }: PushyUpdateHostProps) {
  return children;
}
