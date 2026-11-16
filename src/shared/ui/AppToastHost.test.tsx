import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { RootSiblingParent } from "react-native-root-siblings";
import { ToastContainer } from "react-native-root-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppToastHost } from "./AppToastHost";
import { showGlobalToast, useGlobalToast } from "./app-toast";

// 保留真实 Portal 容器切换行为，仅替换依赖原生动画的 Toast 渲染。
vi.mock("react-native-root-toast", () => ({
  default: {
    durations: { SHORT: 2000, LONG: 3500 },
    positions: { CENTER: 0 },
    show: vi.fn(),
  },
  ToastContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer | undefined;

function Harness({ page, modal = false }: { page: string; modal?: boolean }) {
  return (
    <RootSiblingParent>
      <AppToastHost />
      <RootSiblingParent key={page}>
        {modal ? <RootSiblingParent>身份验证弹窗</RootSiblingParent> : null}
      </RootSiblingParent>
    </RootSiblingParent>
  );
}

async function flushPortalUpdates() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useGlobalToast.setState({ toast: null });
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("跨页面成功提示", () => {
  it("弹窗关闭、原页面卸载后，成功提示仍挂在应用根容器", async () => {
    await act(async () => {
      renderer = create(<Harness page="注销" />);
    });
    await flushPortalUpdates();
    await act(async () => {
      renderer!.update(<Harness page="注销" modal />);
    });
    await act(async () => {
      showGlobalToast("注销申请成功", { duration: 5000 });
    });
    await flushPortalUpdates();
    await act(async () => {
      renderer!.update(<Harness page="首页" />);
    });
    await flushPortalUpdates();

    const toast = renderer!.root.findByType(ToastContainer);
    expect(toast.props.children).toBe("注销申请成功");
    expect(toast.props.visible).toBe(true);
    expect(toast.props.duration).toBe(5000);
  });

  it("连续成功提示重新挂载，旧提示的关闭回调不会清除新提示", async () => {
    await act(async () => {
      renderer = create(<Harness page="实名认证" />);
    });
    await flushPortalUpdates();
    await act(async () => { showGlobalToast("实名认证成功"); });
    await flushPortalUpdates();
    const firstToast = renderer!.root.findByType(ToastContainer);
    const onHidden = firstToast.props.onHidden;
    expect(firstToast.props.duration).toBe(3500);

    await act(async () => { showGlobalToast("实名认证成功"); });
    await flushPortalUpdates();
    const secondToast = renderer!.root.findByType(ToastContainer);
    expect(secondToast).not.toBe(firstToast);
    await act(async () => { onHidden(); });
    expect(useGlobalToast.getState().toast?.message).toBe("实名认证成功");

    await act(async () => { secondToast.props.onHidden(); });
    await flushPortalUpdates();
    expect(renderer!.root.findAllByType(ToastContainer)).toHaveLength(0);
  });
});
