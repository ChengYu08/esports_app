# 消息列表在线状态实时刷新 + 服务端鉴权缓存（P0）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户停留在消息页期间，好友在线/离线状态每 5 秒自动刷新；同时服务端对登录鉴权的 `dj_user` 查询加 Redis 缓存（P0），抵消轮询带来的额外 DB 压力。

**Architecture:**
- App 端：消息页聚焦 + App 前台 + 存在真实会话时启动 5 秒轮询；轮询串行、失败退避、状态无变化不产新引用（4 道门控）。
- 服务端：`ClientTokenInterceptor` 鉴权成功后把 `{id, status, nickname, idCardName, phone}` 写入 Redis（TTL 60s），命中时跳过 `dj_user` 查询；用户状态/昵称/实名变更时主动失效。
- 两端接口契约完全不变。

**Tech Stack:** Expo SDK 57 / RN 0.86 / Zustand / Vitest（App）；Spring Boot + MyBatis-Plus + StringRedisTemplate + Fastjson（pzdj-service）。

**Spec:** 无独立设计稿，需求与根因见本文件「背景与根因」「关键决策」。

---

## 背景与根因（结论摘要）

消息列表的 `isOnline` 只有 4 个刷新触发点，停留在消息页时全部不触发：

| 触发点 | 位置 |
|---|---|
| 消息页聚焦 → `refreshConversations` → `syncConversations` 快照后刷新 | `src/features/message/screens/MessageScreen.tsx:49`、`src/features/message/message-store.ts:368` |
| App 回到前台 | `src/features/message/screens/MessageScreen.tsx:73` |
| 出现新会话 | `src/features/message/message-store.ts:661` |
| 聊天页变为可见 | `src/features/message/components/ChatConversation.tsx:249` |

数据源本身是实时的：融云在线状态回调到达后端后落库（`RongCloudCallbackServiceImpl.handleUserOnlineStatusEvent` → `ClientUserServiceImpl.updateUserOnlineStatus`）。纯客户端缺持续取数通道。

服务端每次登录请求实际打两条 SQL：

1. `ClientTokenInterceptor` → `SELECT * FROM dj_user WHERE id=?`（25 列全查，纯重复开销）
2. `getOnlineStatusMap` → `SELECT user_id, online_status FROM dj_user_extend WHERE user_id IN (...)`

`dj_user_extend` 已有 `uk_user_id` 唯一索引，无需动表结构。

## 关键决策

1. **轮询间隔 5 秒**（用户指定），仅在消息页可见且 App 前台时运行。
2. **接口契约冻结**：`POST /client/v1/user/profile/online-status` 的路由、请求体 `List<String>`、响应体 `Map<String, Integer>`、`token` 头、401 语义一律不变；服务端只做内部缓存，聊天相关其他系统的调用方无感知。
3. **4 道门控**：可见性门控、串行轮询、无变化短路、失败退避不重试。
4. **本次不做的**：服务端 P1（在线状态 Redis 写穿）、回调写路径瘦身、僵尸在线自愈 job；聊天页头部在线状态暂不动。
5. 5 秒轮询下在线状态查询仍是每 5 秒 1 条 DB 查询；若后续 QPS 有压力，按本文件「后续可选」推进 P1。

---

## 全局约束

- App 注释用中文；不用 `void fn()` 形式；`if` 分支必须带大括号；事件回调直接传函数引用（`onPress={fn}`）。
- App 端开发过程中**不跑** lint / typecheck / vitest，只在用户要求提交时一次性跑（项目 skill 规则优先于 AGENTS.md 通用要求）。
- 不主动 commit；用户要求提交时，每个仓库（esports_app / pzdj-service）各合成一个 commit 并 push。
- 服务端本地无 Maven（`which mvn` 为空），无法本地编译/跑测试；服务端验证依赖 CI 构建与 test 环境部署。
- 真机 UI 验证由用户执行，实施方提供验证清单。
- 不做与任务无关的重构、不改接口、不加兜底分支。

---

## 文件结构

| 仓库 | 文件 | 责任 |
|---|---|---|
| esports_app | `src/features/message/message-store.ts`（改） | `refreshOnlineStatuses` 返回成功标记 + 状态无变化短路 |
| esports_app | `src/features/message/hooks/use-online-status-polling.ts`（新建） | 5 秒串行轮询 + 前台门控 + 失败退避 |
| esports_app | `src/features/message/hooks/use-online-status-polling.test.tsx`（新建） | 轮询 hook 行为测试 |
| esports_app | `src/features/message/screens/MessageScreen.tsx`（改） | 接入轮询 hook（聚焦 + 有会话） |
| esports_app | `src/features/message/message-store.test.ts`（改） | 补充 `refreshOnlineStatuses` 三个用例 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/config/token/ClientUserAuthCache.java`（新建） | 鉴权用户信息 Redis 读写/失效 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/config/properties/ClientTokenProperties.java`（改） | 新增缓存 key 前缀与 TTL 配置 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/config/interceptor/ClientTokenInterceptor.java`（改） | 命中缓存跳过 `dj_user` 查询 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/service/client/user/impl/ClientUserServiceImpl.java`（改） | `modifyStatus` / `modifyProfile` / `revokeToken` 失效缓存 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/service/client/user/impl/RealNameServiceImpl.java`（改） | 实名更新后失效缓存 |
| pzdj-service | `src/main/java/com/panzhi/tech/dj/service/client/user/impl/CancellationServiceImpl.java`（改） | 注销流程 `revokeToken` 内失效缓存 |

---

# Part A：App 端（esports_app，分支 feat/tc_god）

## Task A1: store 返回成功标记 + 无变化短路

**Files:**
- Modify: `src/features/message/message-store.ts:99`（类型）、`src/features/message/message-store.ts:454-482`（实现）
- Test: `src/features/message/message-store.test.ts`（在 `describe('message store', ...)` 内追加）

**Interfaces:**
- Produces: `refreshOnlineStatuses: (token: string) => Promise<boolean>` —— 成功（含被更新请求顶替）返回 `true`，网络/接口失败返回 `false`。现有调用方 `void refreshOnlineStatuses(...)` 不受影响。

- [ ] **Step 1: 先写失败测试**

在 `src/features/message/message-store.test.ts` 顶部补充导入（文件已有 `clientAuthApi` 的模块 mock）：

```ts
import { clientAuthApi } from '@/features/auth/client-auth.api';
```

在 `describe('message store', ...)` 内追加三个用例：

```ts
  it('refreshes online flags and reports success', async () => {
    const store = createMessageStore(makeAdapter({ getConversations: vi.fn(async () => [conversation]) }));
    await store.getState().initialize('token');
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockResolvedValueOnce({ '42': 1 });

    await expect(store.getState().refreshOnlineStatuses('token')).resolves.toBe(true);
    expect(store.getState().conversations[0].isOnline).toBe(true);
    await store.getState().reset();
  });

  it('keeps conversations reference when online flags do not change', async () => {
    const store = createMessageStore(makeAdapter({ getConversations: vi.fn(async () => [conversation]) }));
    await store.getState().initialize('token');
    const before = store.getState().conversations;

    await store.getState().refreshOnlineStatuses('token');

    expect(store.getState().conversations).toBe(before);
    await store.getState().reset();
  });

  it('reports failure and keeps the previous snapshot when the request throws', async () => {
    const store = createMessageStore(makeAdapter({ getConversations: vi.fn(async () => [conversation]) }));
    await store.getState().initialize('token');
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockRejectedValueOnce(new Error('network'));
    const before = store.getState().conversations;

    await expect(store.getState().refreshOnlineStatuses('token')).resolves.toBe(false);
    expect(store.getState().conversations).toBe(before);
    await store.getState().reset();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/message/message-store.test.ts`
Expected: FAIL —— `refreshOnlineStatuses` 目前返回 `undefined`，`resolves.toBe(true/false)` 不通过；第三、四条用例同时暴露每次刷新都会产生新数组。

> 注：此步骤属于用户明确要求实施后的开发验证，不违反「普通开发不跑测试」的规则（该规则针对样式/页面迭代）。

- [ ] **Step 3: 修改类型签名**

`src/features/message/message-store.ts:99`：

```ts
  refreshOnlineStatuses: (token: string) => Promise<boolean>;
```

- [ ] **Step 4: 重写 `refreshOnlineStatuses`**

把 `src/features/message/message-store.ts:454-482` 整段替换为：

```ts
      refreshOnlineStatuses: async (token) => {
        const requestId = ++onlineStatusRequestId;
        if (!token) return false;
        const userIds = Array.from(new Set(
          get().conversations
            .filter((conversation) => !isSystemConversationId(conversation.id))
            .map((conversation) => normalizeSystemConversationId(conversation.id))
            .filter(Boolean),
        ));

        try {
          const statuses: Record<string, number> = userIds.length > 0
            ? await clientAuthApi.getUserOnlineStatus(token, userIds)
            : {};
          // 被更新请求顶替不算失败，避免轮询误判进入退避
          if (requestId !== onlineStatusRequestId) return true;
          const requestedIds = new Set(userIds);
          set((state) => {
            let changed = false;
            const conversations = state.conversations.map((conversation) => {
              if (isSystemConversationId(conversation.id)) {
                if (!conversation.isOnline) {
                  return conversation;
                }
                changed = true;
                return { ...conversation, isOnline: false };
              }
              if (!requestedIds.has(conversation.id)) {
                return conversation;
              }
              const isOnline = Number(statuses[conversation.id]) === 1;
              // 状态未变化时复用原对象，避免轮询每 5 秒击穿列表项 memo
              if (Boolean(conversation.isOnline) === isOnline) {
                return conversation;
              }
              changed = true;
              return { ...conversation, isOnline };
            });
            return changed ? { conversations } : state;
          });
          return true;
        } catch {
          // 失败保留旧快照，由调用方按自己的节奏重试
          return false;
        }
      },
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/message/message-store.test.ts`
Expected: PASS（原有用例全部保持通过）

---

## Task A2: 5 秒轮询 hook（4 道门控）

**Files:**
- Create: `src/features/message/hooks/use-online-status-polling.ts`
- Test: `src/features/message/hooks/use-online-status-polling.test.tsx`

**Interfaces:**
- Consumes: `refreshOnlineStatuses: (token: string) => Promise<boolean>`（Task A1）
- Produces: `useOnlineStatusPolling(enabled: boolean, token: string | null): void`；常量 `ONLINE_STATUS_POLL_INTERVAL_MS = 5_000`、`ONLINE_STATUS_POLL_MAX_BACKOFF_MS = 30_000`

- [ ] **Step 1: 先写失败测试**

新建 `src/features/message/hooks/use-online-status-polling.test.tsx`：

```tsx
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock, appStateMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(async () => true),
  appStateMock: {
    currentState: "active" as string,
    handlers: [] as ((state: string) => void)[],
  },
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appStateMock.currentState;
    },
    addEventListener: vi.fn((_event: string, handler: (state: string) => void) => {
      appStateMock.handlers.push(handler);
      return {
        remove: vi.fn(() => {
          appStateMock.handlers = appStateMock.handlers.filter((item) => item !== handler);
        }),
      };
    }),
  },
}));

vi.mock("../message-store", () => ({
  useMessageStore: (selector: (state: { refreshOnlineStatuses: typeof refreshMock }) => unknown) =>
    selector({ refreshOnlineStatuses: refreshMock }),
}));

import { useOnlineStatusPolling } from "./use-online-status-polling";

function Harness({ enabled, token }: { enabled: boolean; token: string | null }) {
  useOnlineStatusPolling(enabled, token);
  return null;
}

function renderHarness(enabled: boolean, token: string | null) {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(<Harness enabled={enabled} token={token} />);
  });
  return renderer as ReactTestRenderer;
}

function emitAppState(state: string) {
  act(() => {
    appStateMock.handlers.forEach((handler) => handler(state));
  });
}

describe("useOnlineStatusPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    refreshMock.mockResolvedValue(true);
    appStateMock.currentState = "active";
    appStateMock.handlers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 5 seconds while enabled and foregrounded", async () => {
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    renderer.unmount();
  });

  it("does not poll when disabled", async () => {
    const renderer = renderHarness(false, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(refreshMock).not.toHaveBeenCalled();
    renderer.unmount();
  });

  it("pauses in background and resumes on foreground", async () => {
    const renderer = renderHarness(true, "token-a");
    emitAppState("background");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMock).not.toHaveBeenCalled();

    emitAppState("active");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    renderer.unmount();
  });

  it("waits for the previous request before scheduling the next tick", async () => {
    let resolveRequest: ((value: boolean) => void) | undefined;
    refreshMock.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    renderer.unmount();
  });

  it("backs off to 30 seconds after consecutive failures", async () => {
    refreshMock.mockResolvedValue(false);
    const renderer = renderHarness(true, "token-a");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // 第 1 次失败后间隔 10s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);

    // 第 2 次失败后间隔 20s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(3);

    // 第 3 次失败后封顶 30s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(4);

    renderer.unmount();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/message/hooks/use-online-status-polling.test.tsx`
Expected: FAIL —— 模块不存在，`Cannot find module './use-online-status-polling'`

- [ ] **Step 3: 实现 hook**

新建 `src/features/message/hooks/use-online-status-polling.ts`：

```ts
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useMessageStore } from "../message-store";

/** 消息页可见时的在线状态轮询间隔 */
export const ONLINE_STATUS_POLL_INTERVAL_MS = 5_000;
/** 连续失败后的最大退避间隔 */
export const ONLINE_STATUS_POLL_MAX_BACKOFF_MS = 30_000;

/**
 * 消息页可见期间轮询会话对端在线状态。
 * 门控：仅 enabled（页面聚焦 + 有真实会话）且 App 前台时计时；
 * 串行：上一轮返回后才排下一轮；失败按 5s/10s/20s/30s 退避，成功立即回到 5s。
 */
export function useOnlineStatusPolling(enabled: boolean, token: string | null) {
  const refreshOnlineStatuses = useMessageStore(
    (state) => state.refreshOnlineStatuses,
  );
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === "active",
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !appActive || !token) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const schedule = (delay: number) => {
      timer = setTimeout(async () => {
        const succeeded = await refreshOnlineStatuses(token);
        if (cancelled) {
          return;
        }
        failures = succeeded ? 0 : failures + 1;
        const nextDelay = failures === 0
          ? ONLINE_STATUS_POLL_INTERVAL_MS
          : Math.min(
              ONLINE_STATUS_POLL_INTERVAL_MS * 2 ** failures,
              ONLINE_STATUS_POLL_MAX_BACKOFF_MS,
            );
        schedule(nextDelay);
      }, delay);
    };

    schedule(ONLINE_STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [appActive, enabled, refreshOnlineStatuses, token]);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/message/hooks/use-online-status-polling.test.tsx`
Expected: PASS（5 个用例全绿）

---

## Task A3: 消息页接入轮询

**Files:**
- Modify: `src/features/message/screens/MessageScreen.tsx:1-80`

**Interfaces:**
- Consumes: `useOnlineStatusPolling(enabled, token)`（Task A2）

- [ ] **Step 1: 引入 hook 与聚焦状态**

`src/features/message/screens/MessageScreen.tsx` 顶部：

```tsx
import { router, useFocusEffect, useIsFocused } from "expo-router";
```

```tsx
import { useOnlineStatusPolling } from "../hooks/use-online-status-polling";
```

- [ ] **Step 2: 在组件内接入**

在 `const clearAllUnread = useMessageStore(...)` 之后、`handleClear` 之前加入：

```tsx
  const isFocused = useIsFocused();
  // 只有存在真实会话时才轮询；纯系统会话（通知/订单助手）没有在线状态
  const hasPeerConversations = useMemo(
    () => conversations.some((item) => !isSystemConversationId(item.id)),
    [conversations],
  );
  useOnlineStatusPolling(isFocused && hasPeerConversations, accessToken);
```

说明：
- 已有的 `useFocusEffect`（聚焦立即刷新）和 `AppState` 监听（回前台立即刷新）保留不动；hook 只负责「停留期间的 5 秒节奏」。
- 首次轮询在进入页面 5 秒后发生，聚焦瞬间的状态由既有逻辑立即刷新。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误（该命令留到提交节点执行，开发中间态不跑）

---

# Part B：服务端 P0（pzdj-service）

> 服务端改动全部在内部，接口契约、路由、响应体、401 语义均不变。
> 本地无 Maven，Task B1~B3 以代码审查 + CI 构建作为验证手段；无法本地跑单测。

## Task B1: 缓存配置项与缓存组件

**Files:**
- Modify: `src/main/java/com/panzhi/tech/dj/config/properties/ClientTokenProperties.java`
- Create: `src/main/java/com/panzhi/tech/dj/config/token/ClientUserAuthCache.java`

**Interfaces:**
- Produces:
  - `ClientUserAuthCache.get(Long userId): CachedClientUser | null`
  - `ClientUserAuthCache.put(Long userId, UserEntity user): void`
  - `ClientUserAuthCache.evict(Long userId): void`
  - `ClientUserAuthCache.CachedClientUser` 字段：`Long id`、`Integer status`、`String nickname`、`String idCardName`、`String phone`

- [ ] **Step 1: 增加配置项**

`ClientTokenProperties.java` 在 `userKeyPrefix` 之后追加：

```java
    /**
     * redis key 前缀：userId -> 鉴权用户信息缓存（状态/昵称/实名/手机号）
     */
    private String authKeyPrefix = "dj:client:auth:";

    /**
     * 鉴权用户信息缓存有效期（秒）；<= 0 时不使用缓存（回滚开关）
     */
    private Long authCacheSeconds = 60L;
```

- [ ] **Step 2: 新建缓存组件**

新建 `src/main/java/com/panzhi/tech/dj/config/token/ClientUserAuthCache.java`：

```java
package com.panzhi.tech.dj.config.token;

import com.alibaba.fastjson.JSON;
import com.panzhi.tech.dj.config.properties.ClientTokenProperties;
import com.panzhi.tech.dj.dao.entity.sys.UserEntity;
import jakarta.annotation.Resource;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * C 端鉴权用户信息缓存。
 * <p>
 * token 校验通过后拦截器需要用户状态、昵称、实名、手机号；这些字段读多写少，
 * 缓存 60 秒可避免每个登录请求都回查 dj_user（25 列全查）。
 * 用户状态/昵称/实名变更处主动调用 {@link #evict(Long)}，TTL 只作为兜底。
 */
@Slf4j
@Component
public class ClientUserAuthCache {

    @Resource
    private ClientTokenProperties clientTokenProperties;

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    /**
     * 读取缓存；未命中、Redis 异常或缓存开关关闭时返回 null，由调用方回查数据库。
     */
    public CachedClientUser get(Long userId) {
        if (userId == null || !cacheEnabled()) {
            return null;
        }
        try {
            String value = stringRedisTemplate.opsForValue().get(buildKey(userId));
            if (StringUtils.isBlank(value)) {
                return null;
            }
            return JSON.parseObject(value, CachedClientUser.class);
        } catch (Exception e) {
            log.debug("读取C端鉴权用户缓存失败, userId={}", userId, e);
            return null;
        }
    }

    /**
     * 写入缓存；失败只记录日志，不影响鉴权主流程。
     */
    public void put(Long userId, UserEntity user) {
        if (userId == null || user == null || !cacheEnabled()) {
            return;
        }
        CachedClientUser cached = new CachedClientUser();
        cached.setId(user.getId());
        cached.setStatus(user.getStatus());
        cached.setNickname(user.getNickname());
        cached.setIdCardName(user.getIdCardName());
        cached.setPhone(user.getPhone());
        try {
            stringRedisTemplate.opsForValue().set(
                    buildKey(userId),
                    JSON.toJSONString(cached),
                    Duration.ofSeconds(clientTokenProperties.getAuthCacheSeconds()));
        } catch (Exception e) {
            log.debug("写入C端鉴权用户缓存失败, userId={}", userId, e);
        }
    }

    /**
     * 主动失效；失败只记录日志，TTL 兜底。
     */
    public void evict(Long userId) {
        if (userId == null) {
            return;
        }
        try {
            stringRedisTemplate.delete(buildKey(userId));
        } catch (Exception e) {
            log.debug("删除C端鉴权用户缓存失败, userId={}", userId, e);
        }
    }

    private boolean cacheEnabled() {
        Long seconds = clientTokenProperties.getAuthCacheSeconds();
        return seconds != null && seconds > 0;
    }

    private String buildKey(Long userId) {
        return clientTokenProperties.getAuthKeyPrefix() + userId;
    }

    /**
     * 缓存内容：只保留拦截器组装 ClientUserContext 需要的字段。
     */
    @Data
    public static class CachedClientUser {
        private Long id;
        private Integer status;
        private String nickname;
        private String idCardName;
        private String phone;
    }
}
```

> `CachedClientUser` 刻意不用 `@Accessors(chain = true)`：Fastjson 对链式 setter（返回非 void）的反序列化支持不稳定，普通 setter 更安全。

- [ ] **Step 3: 代码审查检查点**

- `ClientTokenProperties` 位于 `config/properties`，`ClientUserAuthCache` 位于 `config/token`，后者已 import 前者，无循环依赖。
- `StringRedisTemplate` 在本项目已有大量使用（`ClientTokenInterceptor`、`CancellationServiceImpl`）。
- `UserEntity.getStatus()` 为 `Integer`，与 `CachedClientUser.status` 一致。

---

## Task B2: 拦截器命中缓存跳过 `dj_user` 查询

**Files:**
- Modify: `src/main/java/com/panzhi/tech/dj/config/interceptor/ClientTokenInterceptor.java:72-96`

**Interfaces:**
- Consumes: `ClientUserAuthCache.get/put`（Task B1）

- [ ] **Step 1: 注入缓存组件**

在 `ClientTokenInterceptor` 的 `@Resource` 区域追加：

```java
    @Resource
    private ClientUserAuthCache clientUserAuthCache;
```

并补充 import：

```java
import com.panzhi.tech.dj.config.token.ClientUserAuthCache;
```

- [ ] **Step 2: 替换数据库查询段**

把 `ClientTokenInterceptor.java` 中 `Object userId = ...` 之后、`stringRedisTemplate.expire(...)` 之前的用户校验段（原第 75-88 行，含 `UserEntity clientUser = clientUserService.getById(...)` 到 `String nickname = clientUser.getNickname();`）替换为：

```java
        Long currentUserId = Long.valueOf(String.valueOf(userId));
        ClientUserAuthCache.CachedClientUser cachedUser = clientUserAuthCache.get(currentUserId);
        String nickname;
        String idCardName;
        String phone;
        if (cachedUser == null) {
            UserEntity clientUser = clientUserService.getById(currentUserId);
            if (clientUser == null || !ClientUserStatusEnum.NORMAL.matches(clientUser.getStatus())) {
                notLoginResponse(response);
                return Boolean.FALSE;
            }
            clientUserAuthCache.put(currentUserId, clientUser);
            nickname = clientUser.getNickname();
            idCardName = clientUser.getIdCardName();
            phone = clientUser.getPhone();
        } else {
            if (!ClientUserStatusEnum.NORMAL.matches(cachedUser.getStatus())) {
                notLoginResponse(response);
                return Boolean.FALSE;
            }
            nickname = cachedUser.getNickname();
            idCardName = cachedUser.getIdCardName();
            phone = cachedUser.getPhone();
        }
```

- [ ] **Step 3: 替换上下文写入**

把原来的 `String idCardName = clientUser.getIdCardName();`、`String nickname = clientUser.getNickname();` 以及 `ClientUserContext.set(...)` 替换为：

```java
        ClientUserContext.set(
                new ClientUser()
                        .setId(currentUserId)
                        .setRealName(StringUtils.isBlank(idCardName) ? nickname : idCardName)
                        .setPhone(phone)
                        .setName(nickname)
        );
```

- [ ] **Step 4: 行为确认**

- 缓存未命中：与改动前完全一致（查库 → 校验状态 → 写缓存 → 写上下文）。
- 缓存命中且状态非 NORMAL：401，与改动前一致（仅数据来源不同）。
- Redis 异常：`get` 返回 null → 回落查库，鉴权不受影响。
- token 续签的两条 Redis 操作保持原位置、原参数不变。

---

## Task B3: 用户变更处主动失效缓存

**Files:**
- Modify: `src/main/java/com/panzhi/tech/dj/service/client/user/impl/ClientUserServiceImpl.java`
- Modify: `src/main/java/com/panzhi/tech/dj/service/client/user/impl/RealNameServiceImpl.java`
- Modify: `src/main/java/com/panzhi/tech/dj/service/client/user/impl/CancellationServiceImpl.java`

**Interfaces:**
- Consumes: `ClientUserAuthCache.evict(Long)`（Task B1）

- [ ] **Step 1: `ClientUserServiceImpl` 注入并失效**

在 `@Resource` 区域追加：

```java
    @Resource
    private ClientUserAuthCache clientUserAuthCache;
```

import：

```java
import com.panzhi.tech.dj.config.token.ClientUserAuthCache;
```

三处调用：

1. `modifyStatus(...)`：在 `baseMapper.updateById(update)` 成功断言之后、`userProfileEventService.publishChanged(...)` 之前加入：

```java
        clientUserAuthCache.evict(modifyClientUserStatusAction.getId());
```

2. `modifyProfile(...)`：在 `baseMapper.updateById(changes)` 与异常处理之后、`companionSearchEventPublisher.publish(...)` 之前加入（只有昵称变化才影响缓存内容）：

```java
        if (nicknameChanged) {
            clientUserAuthCache.evict(user.getId());
        }
```

3. `revokeToken(Long userId)`：在 `stringRedisTemplate.delete(userKey);` 之后加入：

```java
        clientUserAuthCache.evict(userId);
```

> `revokeToken` 覆盖「禁用 / 注销」两条强制下线路径，保证缓存与吊销同步。

- [ ] **Step 2: `RealNameServiceImpl` 实名后失效**

注入：

```java
    @Resource
    private ClientUserAuthCache clientUserAuthCache;
```

import：

```java
import com.panzhi.tech.dj.config.token.ClientUserAuthCache;
```

在 `elementSmartVerify` 中 `updateById(update);` 之后（`companionProfileMapper.updateSexByUserId(...)` 之前）加入：

```java
        clientUserAuthCache.evict(user.getId());
```

- [ ] **Step 3: `CancellationServiceImpl` 注销后失效**

注入：

```java
    @Resource
    private ClientUserAuthCache clientUserAuthCache;
```

import：

```java
import com.panzhi.tech.dj.config.token.ClientUserAuthCache;
```

在该类私有方法 `revokeToken(Long userId)` 的 `redisUtil.delete(userKey);` 之后加入：

```java
            clientUserAuthCache.evict(userId);
```

> 注销申请（状态置 CANCELLING）与注销完成（状态 3、昵称/手机/实名清空）两条路径都会调用该方法，一次覆盖。

- [ ] **Step 4: 失效点自检**

| 变更 | 是否影响缓存字段 | 失效调用 |
|---|---|---|
| 禁用 / 注销（modifyStatus） | status | ✅ `modifyStatus` + `revokeToken` |
| 昵称修改（modifyProfile） | nickname | ✅ |
| 实名认证（elementSmartVerify） | idCardName | ✅ |
| 注销冷静期 / 注销完成 | status、nickname、phone、idCardName | ✅ `revokeToken` |
| 头像 / 签名 / 在线状态 | 无（不在缓存内） | 不需要 |
| 管理员直接改库 | 未知 | TTL 60s 兜底 |

---

# 验证与验收

## App 端

- [ ] 提交前一次性执行：
  - `npx tsc --noEmit`
  - `npx vitest run src/features/message`
  - `npx expo lint`（只关注本次涉及文件）
- [ ] 真机验证清单（用户执行）：
  1. 停留消息页，让好友上下线（另一台设备切换前后台），5~10 秒内小绿点变化。
  2. 切到首页再切回：立即刷新一次（既有逻辑）。
  3. 退到后台再回前台：立即刷新，随后恢复 5 秒节奏。
  4. 消息页无真实会话（只有系统通知）时不发轮询请求（可用抓包/Metro 日志确认）。
  5. 断网 30 秒再恢复：请求间隔按 5→10→20→30 秒退避，网络恢复后回到 5 秒一次。
  6. 停留在消息页 5 分钟，列表滚动/点击不卡顿，绿色小点只在该变化的行更新（避免整列表每 5 秒重渲染）。

## 服务端

- [ ] 本地：`git diff` 自查 + Task B3 Step 4 的失效点表格核对（本地无 Maven，不做编译验证）。
- [ ] CI：push 后确认 pzdj-service 构建通过。
- [ ] test 环境功能验收：
  1. 任意 C 端登录接口正常返回（登录态解析不受影响）。
  2. 同一 token 连续请求，`dj_user` 查询在缓存命中时不再出现（可在 test 库 `performance_schema` 或慢日志观察）；接口响应结构与改动前一致。
  3. 后台禁用该用户 → 立即 401（`revokeToken` + `evict`）。
  4. 用户改昵称 → 下一请求 `ClientUserContext.name` 即为新昵称（`evict`）。
  5. 实名认证后 → `realName` 立即更新。
  6. 注销申请后 → 强制下线、再登录提示已在冷静期。
- [ ] 回归：客服/订单/青少年模式等依赖 `ClientUserContext` 的接口抽测。

## 接口契约冻结确认

- [ ] 路由、请求体（`List<String>`）、响应体（`Map<String, Integer>`）、`token` 头、401 语义零改动。
- [ ] 其他系统（PC、客服后台、脚本）调用在线状态接口与聊天相关接口无感。

---

# 风险与回滚

| 风险 | 影响 | 处置 |
|---|---|---|
| 5 秒轮询流量翻倍（相对 10 秒） | 在线状态查询 12 次/分钟/人 | P0 已抵消掉鉴权查询；若仍紧张，推进 P1（Redis 写穿） |
| 缓存失效遗漏导致昵称/实名短暂过期 | ≤ 60s 展示延迟 | 已覆盖全部写路径；TTL 兜底 |
| 缓存命中掩盖禁用状态 | 不会：禁用路径先 `evict` 再吊销 token（token 失效即 401） | — |
| Redis 抖动 | 鉴权回退查库，功能不降级 | `get` 异常返回 null |
| 轮询在页面不可见时仍跑 | 耗电/无效请求 | 可见性 + AppState 双门控，失焦即清定时器 |
| 整列表每 5 秒重渲染 | 滑动卡顿 | store 无变化短路（A1）复用原对象 |

**回滚：**
- App：删除 `MessageScreen` 中 `useOnlineStatusPolling(...)` 一行即可回到现状；store 短路逻辑可保留。
- 服务端：把 `dj.client.token.authCacheSeconds` 设为 `0` 即关闭缓存（代码内置开关），无需回滚代码；或直接回滚提交。

---

# 后续可选（本次不做）

1. **P1 在线状态 Redis 写穿**：融云回调更新 DB 后写 `im:online:{userId}`；查询用 pipeline GET，未命中回落 DB。可把轮询的 DB 压力降到 0。
2. **回调写路径瘦身**：`updateUserOnlineStatus` 去掉 `selectById` 存在性检查，合并两条 `companion_profile` 更新（5 条 SQL → 3 条）。
3. **僵尸在线自愈 job**：`online_sync_time` 目前无人使用；加低频 job 调融云 `user/status/check` 纠正丢失回调导致的永久在线。
4. **聊天页头部在线状态轮询**：复用本 hook，按需接入。
