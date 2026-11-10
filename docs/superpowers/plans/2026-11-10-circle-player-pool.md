# 盼友圈全局播放器池（抖音式）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 3 个全局共享的 `VideoPlayer` 实例替代每卡一个播放器，结构性杜绝跨屏双声（话题页/作品页/主信息流重叠播放），同时保留现有翻页体验（预加载 surface、回滑秒恢复）。

**Architecture:** 模块级单例池持有 3 个 `VideoPlayer`（命令式 `new VideoPlayer` 创建，永不销毁）。窗口 [i-1, i+1] 内的卡片按 postId 向池"认领"播放器；播放器保留其源直到该 postId 离开窗口。只有"当前聚焦 feed"（`activeFeedId`）能认领和播放——焦点仲裁由各屏的 focus 事件驱动，条件释放保证乱序安全。卡片层渲染 `VideoView` 并绑定池分配的 player（key 含 slot，翻页时绑定不变故无重挂载）。

**Tech Stack:** react-native-video 7.0.0-beta.12（Nitro）、zustand 5、vitest（node 环境）。

**Spec:** 本对话（2026-11-10）的需求：滑动播放视频 → 点话题进话题页 → 点其他视频出现声音重叠；要求多场景适用、对齐抖音的共享播放器池方案。

## Global Constraints

- react-native-video 版本固定 7.0.0-beta.12（`package.json`），`VideoPlayer` 类从包根导出，`replaceSourceAsync` / `preload` / `play` / `pause` 均可用（已验证源码）。
- `useEvent(player, event, cb)` 以 `[player, event, callback]` 为 effect 依赖，player 实例切换会自动重订阅（已验证 `node_modules/react-native-video/src/core/hooks/useEvent.ts`）。
- 池大小固定 3（active / preload / retain 三个角色），不做可配置。
- `VideoView` 的 `surfaceType`：Android 用 `"texture"`、iOS 用 `undefined`，与现状一致。
- 注释写中文；不写 `void fn(){}`、`if() return;` 式代码（AGENTS.md 规则）。
- 不修改 `ios/`、`android/` 原生目录。
- 首帧判定沿用现有约定：`onProgress` 的 `currentTime > 0`（Android `onReadyToDisplay` 早于真实首帧）。

---

## 背景与现状（执行者必读）

**双声根因：**
- [src/features/circle/screens/CircleScreen.tsx:49](../../../src/features/circle/screens/CircleScreen.tsx) 的 `active` 来自 HomeScreen 内部 `topTab` 状态（[src/features/home/screens/HomeScreen.tsx:385](../../../src/features/home/screens/HomeScreen.tsx)），**不是路由焦点**。push `/circle/search` 后 Home 的 topTab 仍为 "circle"，底层视频继续出声。
- `CircleSearchResultsScreen.tsx:39`、`CircleUserVideosScreen.tsx:52` 各自只看 AppState + 语聊房，同样不感知上层路由。
- 每张卡一个 `useVideoPlayer`（[src/features/circle/components/CircleVideoPlayer.tsx:28](../../../src/features/circle/components/CircleVideoPlayer.tsx)），多个屏各自实例化 → 播放器数量随屏增长。

**现有关键机制（必须保留的行为）：**
1. `CircleVideoCard` 仅在 `(active || shouldPreload || shouldRetain)` 时挂载播放器；preload 卡提前建 surface，翻页无黑纹理（`CircleVideoCard.tsx:197` 注释）。
2. 封面淡出依赖首帧确认（`onProgress currentTime>0`）；卡片失活时封面复位盖住画面。
3. `shouldRetain`（上一页）保留播放器，回滑秒恢复。
4. 3 秒有效播放上报 `reportCircleVideoPlay`，卸载时补报（`CircleVideoPlayer.tsx:107-118`）。
5. 播放失败重试：卡片 `key={post.id:playerAttempt}` 重挂载（`CircleVideoCard.tsx:199`）。
6. 语聊房加入 / 退后台 → `shouldPlay=false` → 暂停且卸载播放器。

**池化后的轮转不变量（方案核心）：** 翻页 i→i+1 时，i+1 的 VideoView 已经绑着持有 post[i+1] 的播放器（预加载时认领），i 保留持有 post[i] 的播放器，被释放的 post[i-1] 播放器换源成 post[i+2] 预加载。**卡片↔播放器的绑定在翻页时不变**，所以不产生重挂载/黑屏；只有新进窗口的卡片才挂载新 VideoView（与今天的 preload 挂载成本一致）。

**焦点仲裁（条件释放模式）：** 每个播放面在聚焦时 `activateFeed(feedId)`，失焦时 `conditionalRelease(feedId)`（仅当自己是 activeFeed 才清空）。push 新屏时无论"新屏先 focus"还是"旧屏先 blur"，结果一致：新 feed 持有仲裁权。旧 feed 的持有者被暂停并释放，播放器被新 feed 换源复用。返回时旧 feed 重新认领——池优先把"空闲且源就是该 post"的 slot 发出去（无需换源，走 HTTP 缓存秒恢复）。

---

### Task 1: 播放器池核心（store + 类 + 单测，TDD）

**Files:**
- Create: `src/features/circle/circle-player-pool.ts`
- Test: `src/features/circle/circle-player-pool.test.ts`

**Interfaces:**
- Consumes: `zustand`、`VideoPlayer`（仅类型，生产单例才真正实例化）。
- Produces（Task 2/3 依赖，签名必须一致）:
  - `export type CirclePoolSlot = 0 | 1 | 2`
  - `export type PoolableVideoPlayer = { play(): void; pause(): void; preload(): Promise<void>; replaceSourceAsync(source: { uri: string } | null): Promise<void>; loop: boolean; playInBackground: boolean; playWhenInactive: boolean }`
  - `export type CirclePoolSource = { id: string; videoUrl: string }`
  - `export class CirclePlayerPool<Player extends PoolableVideoPlayer>`，方法：
    - `claim(feedId: string, post: CirclePoolSource, opts?: { force?: boolean }): CirclePoolSlot | null`
    - `release(slot: CirclePoolSlot, feedId: string, postId: string): void`
    - `activateFeed(feedId: string | null): void`
    - `conditionalRelease(feedId: string): void`
    - `ensurePreload(slot: CirclePoolSlot): void`
    - `holdsSource(slot: CirclePoolSlot, postId: string): boolean`
    - `getPlayer(slot: CirclePoolSlot): Player | null`
  - `export const useCirclePlayerPoolStore: zustand store`（`{ activeFeedId: string | null; holders: (CirclePoolHolder | null)[] }`）
  - `export const circlePlayerPool: CirclePlayerPool<VideoPlayer>`（生产单例，懒创建播放器）
  - `export const CIRCLE_HOME_FEED_ID = "circle-home"`
  - `export function usePooledCirclePlayer(...)`（Task 2 实现放同文件，本任务先不写）

**换源时序规则（防旧源事件污染首帧判定）：** `sourcePostIds[slot]` 在两种时机更新——(a) 播放器首次创建时立即；(b) `await replaceSourceAsync` 完成**之后**。`holdsSource(slot, postId)` 据此判断：换源进行中返回 false，卡片用它过滤旧源的 `onProgress`（避免旧源进度触发放假首帧、封面提前淡出露出旧画面）。

**驱逐顺序（pickSlot）：**
1. 空闲且 `sourcePostIds[slot] === post.id`（回场景零换源）
2. 持有者是其他 feed（`holder.feedId !== activeFeedId`）
3. 空闲且尚未创建播放器（新 slot 无需换源）
4. 空闲（源不匹配，需换源）
5. FIFO（最老认领）

- [ ] **Step 1: 写失败测试**

```ts
// src/features/circle/circle-player-pool.test.ts
import { create } from "zustand";
import { describe, expect, it, vi } from "vitest";

import { CirclePlayerPool, type PoolableVideoPlayer } from "./circle-player-pool";

class FakePlayer implements PoolableVideoPlayer {
  loop = false;
  playInBackground = false;
  playWhenInactive = false;
  playCount = 0;
  pauseCount = 0;
  preloadCount = 0;
  replacedUris: string[] = [];

  play() {
    this.playCount += 1;
  }
  pause() {
    this.pauseCount += 1;
  }
  preload() {
    this.preloadCount += 1;
    return Promise.resolve();
  }
  replaceSourceAsync(source: { uri: string } | null) {
    this.replacedUris.push(source?.uri ?? "");
    return Promise.resolve();
  }
}

function setup() {
  const store = create<{
    activeFeedId: string | null;
    holders: ({ feedId: string; postId: string } | null)[];
  }>(() => ({ activeFeedId: null, holders: [null, null, null] }));
  const factory = vi.fn(() => new FakePlayer());
  const pool = new CirclePlayerPool(factory, store);
  return { pool, store, factory };
}

const post = (id: string) => ({ id, videoUrl: `https://cdn/${id}.m3u8` });

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("CirclePlayerPool", () => {
  it("feed 未激活时 claim 返回 null", () => {
    const { pool } = setup();
    expect(pool.claim("feed-a", post("1"))).toBeNull();
  });

  it("claim 记录持有者，release 归还 slot", () => {
    const { pool, store } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    expect(slot).not.toBeNull();
    expect(store.getState().holders[slot!]).toEqual({ feedId: "feed-a", postId: "1" });
    pool.release(slot!, "feed-a", "1");
    expect(store.getState().holders[slot!]).toBeNull();
  });

  it("同 post 重复 claim 幂等且不换源", async () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    const again = pool.claim("feed-a", post("1"));
    expect(again).toBe(slot);
    await flush();
    const player = pool.getPlayer(slot!) as FakePlayer;
    expect(player.replacedUris).toHaveLength(0);
  });

  it("翻页轮转：已持有的 post 不换源，离窗 post 的 slot 被回收给新预加载", async () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    // 窗口 [i-1, i, i+1] = [c, a, b]
    const slotC = pool.claim("feed-a", post("c"));
    const slotA = pool.claim("feed-a", post("a"));
    const slotB = pool.claim("feed-a", post("b"));
    await flush();
    // 翻页到 b：c 离开窗口释放，d 进入窗口预加载
    pool.release(slotC!, "feed-a", "c");
    const slotD = pool.claim("feed-a", post("d"));
    expect(slotD).toBe(slotC);
    await flush();
    expect((pool.getPlayer(slotA!) as FakePlayer).replacedUris).toHaveLength(0);
    expect((pool.getPlayer(slotB!) as FakePlayer).replacedUris).toHaveLength(0);
    expect((pool.getPlayer(slotD!) as FakePlayer).replacedUris).toContain("https://cdn/d.m3u8");
  });

  it("换源完成后 holdsSource 才为 true", async () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    expect(pool.holdsSource(slot!, "1")).toBe(true);
    // 占满三个 slot 后第 4 个 claim 走 FIFO 驱逐 + replace 换源路径
    pool.claim("feed-a", post("2"));
    pool.claim("feed-a", post("3"));
    const replaced = pool.claim("feed-a", post("4"));
    expect(replaced).toBe(slot);
    expect(pool.holdsSource(replaced!, "4")).toBe(false);
    await flush();
    expect(pool.holdsSource(replaced!, "4")).toBe(true);
    expect((pool.getPlayer(replaced!) as FakePlayer).replacedUris).toContain("https://cdn/4.m3u8");
  });

  it("返回场景优先复用空闲且源匹配的 slot（零换源）", async () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    await flush();
    pool.release(slot!, "feed-a", "1");
    // 离开窗口期间，其他 post 进入窗口（应优先用全新 slot 而非抢走源匹配的 slot）
    const other = pool.claim("feed-a", post("2"));
    expect(other).not.toBe(slot);
    const back = pool.claim("feed-a", post("1"));
    expect(back).toBe(slot);
    await flush();
    expect((pool.getPlayer(back!) as FakePlayer).replacedUris).toHaveLength(0);
  });

  it("activateFeed 切换时暂停并释放其他 feed 的持有者", async () => {
    const { pool, store } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    await flush();
    pool.activateFeed("feed-b");
    expect(store.getState().holders[slot!]).toBeNull();
    expect((pool.getPlayer(slot!) as FakePlayer).pauseCount).toBeGreaterThan(0);
    expect(pool.claim("feed-b", post("9"))).not.toBeNull();
  });

  it("conditionalRelease 仅在自己是 activeFeed 时清空", () => {
    const { pool, store } = setup();
    pool.activateFeed("feed-a");
    pool.conditionalRelease("feed-b");
    expect(store.getState().activeFeedId).toBe("feed-a");
    pool.conditionalRelease("feed-a");
    expect(store.getState().activeFeedId).toBeNull();
  });

  it("force 触发同源重载（播放失败重试）", async () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    await flush();
    const again = pool.claim("feed-a", post("1"), { force: true });
    expect(again).toBe(slot);
    await flush();
    expect((pool.getPlayer(slot!) as FakePlayer).replacedUris).toContain("https://cdn/1.m3u8");
  });

  it("ensurePreload 调用 preload", () => {
    const { pool } = setup();
    pool.activateFeed("feed-a");
    const slot = pool.claim("feed-a", post("1"));
    pool.ensurePreload(slot!);
    expect((pool.getPlayer(slot!) as FakePlayer).preloadCount).toBeGreaterThan(0);
  });

  it("播放器懒创建：未 claim 前不实例化", () => {
    const { pool, factory } = setup();
    pool.activateFeed("feed-a");
    expect(factory).not.toHaveBeenCalled();
    pool.claim("feed-a", post("1"));
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/circle/circle-player-pool.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现池核心**

```ts
// src/features/circle/circle-player-pool.ts
import { create } from "zustand";
import type { VideoPlayer } from "react-native-video";
import { VideoPlayer as VideoPlayerClass } from "react-native-video";

export const CIRCLE_HOME_FEED_ID = "circle-home";

export type CirclePoolSlot = 0 | 1 | 2;

const POOL_SIZE = 3;

/** 池内播放器的最小结构约束；react-native-video 的 VideoPlayer 天然满足。 */
export type PoolableVideoPlayer = {
  play(): void;
  pause(): void;
  preload(): Promise<void>;
  replaceSourceAsync(source: { uri: string } | null): Promise<void>;
  loop: boolean;
  playInBackground: boolean;
  playWhenInactive: boolean;
};

export type CirclePoolSource = { id: string; videoUrl: string };

export type CirclePoolHolder = { feedId: string; postId: string } | null;

type CirclePlayerPoolState = {
  activeFeedId: string | null;
  holders: CirclePoolHolder[];
};

/** 只读给卡片层订阅 feedActive；写操作一律走 CirclePlayerPool。 */
export const useCirclePlayerPoolStore = create<CirclePlayerPoolState>(() => ({
  activeFeedId: null,
  holders: [null, null, null],
}));

export class CirclePlayerPool<Player extends PoolableVideoPlayer> {
  private players: (Player | null)[] = [null, null, null];
  /** 播放器当前源对应的 postId；仅在创建时或换源完成后更新，换源进行中为 null。 */
  private sourcePostIds: (string | null)[] = [null, null, null];
  private claimOrder: CirclePoolSlot[] = [];

  constructor(
    private readonly createPlayer: (source: { uri: string }) => Player,
    private readonly store = useCirclePlayerPoolStore,
  ) {}

  /** 激活某个 feed 的播放资格；其他 feed 的持有者立即暂停并释放。 */
  activateFeed(feedId: string | null) {
    if (this.store.getState().activeFeedId === feedId) {
      return;
    }
    this.store.setState({ activeFeedId: feedId });
    if (feedId === null) {
      this.pauseAll();
      return;
    }
    this.forEachHolder((holder, slot) => {
      if (holder && holder.feedId !== feedId) {
        this.players[slot]?.pause();
        this.setHolder(slot, null);
      }
    });
  }

  /** 失焦时调用：仅当自己仍持有仲裁权才清空，避免与新屏 focus 的顺序竞争。 */
  conditionalRelease(feedId: string) {
    if (this.store.getState().activeFeedId === feedId) {
      this.activateFeed(null);
    }
  }

  claim(feedId: string, post: CirclePoolSource, opts?: { force?: boolean }): CirclePoolSlot | null {
    if (this.store.getState().activeFeedId !== feedId) {
      return null;
    }
    const holders = this.store.getState().holders;
    const existing = holders.findIndex(
      (holder) => holder?.feedId === feedId && holder.postId === post.id,
    );
    if (existing >= 0) {
      if (opts?.force) {
        void this.reload(existing, post);
      }
      return existing as CirclePoolSlot;
    }
    const slot = this.pickSlot(post.id);
    const evicted = this.store.getState().holders[slot];
    if (evicted) {
      this.players[slot]?.pause();
    }
    this.setHolder(slot, { feedId, postId: post.id });
    void this.load(slot, post);
    return slot;
  }

  release(slot: CirclePoolSlot, feedId: string, postId: string) {
    const holder = this.store.getState().holders[slot];
    if (!holder || holder.feedId !== feedId || holder.postId !== postId) {
      return;
    }
    this.players[slot]?.pause();
    this.setHolder(slot, null);
  }

  ensurePreload(slot: CirclePoolSlot) {
    void this.players[slot]?.preload().catch(() => undefined);
  }

  /** 换源完成前返回 false，用于过滤旧源的 onProgress 假首帧。 */
  holdsSource(slot: CirclePoolSlot, postId: string) {
    return this.sourcePostIds[slot] === postId;
  }

  getPlayer(slot: CirclePoolSlot) {
    return this.players[slot];
  }

  pauseAll() {
    this.players.forEach((player) => {
      player?.pause();
    });
  }

  private pickSlot(postId: string): CirclePoolSlot {
    const holders = this.store.getState().holders;
    const slots = [0, 1, 2] as CirclePoolSlot[]; // 对应 POOL_SIZE=3
    const freeMatch = slots.find((slot) => holders[slot] === null && this.sourcePostIds[slot] === postId);
    if (freeMatch !== undefined) {
      return freeMatch;
    }
    const activeFeedId = this.store.getState().activeFeedId;
    const foreign = slots.find((slot) => holders[slot]?.feedId !== activeFeedId);
    if (foreign !== undefined) {
      return foreign;
    }
    const fresh = slots.find((slot) => holders[slot] === null && this.players[slot] === null);
    if (fresh !== undefined) {
      return fresh;
    }
    const free = slots.find((slot) => holders[slot] === null);
    if (free !== undefined) {
      return free;
    }
    return this.claimOrder[0] ?? 0;
  }

  private async load(slot: CirclePoolSlot, post: CirclePoolSource) {
    const player = this.players[slot] ?? this.createPlayerWithSource(slot, post);
    this.applyPlaybackConfig(player);
    if (this.sourcePostIds[slot] !== post.id) {
      // 先清标记：换源期间 holdsSource 为 false，旧源事件被卡片层过滤
      this.sourcePostIds[slot] = null;
      await player.replaceSourceAsync({ uri: post.videoUrl });
      this.sourcePostIds[slot] = post.id;
      this.applyPlaybackConfig(player);
    }
  }

  private async reload(slot: CirclePoolSlot, post: CirclePoolSource) {
    const player = this.players[slot];
    if (!player) {
      return;
    }
    this.sourcePostIds[slot] = null;
    await player.replaceSourceAsync({ uri: post.videoUrl });
    this.sourcePostIds[slot] = post.id;
    this.applyPlaybackConfig(player);
  }

  private createPlayerWithSource(slot: CirclePoolSlot, post: CirclePoolSource) {
    const player = this.createPlayer({ uri: post.videoUrl });
    this.players[slot] = player;
    this.sourcePostIds[slot] = post.id;
    return player;
  }

  /** replaceSourceAsync 可能重置配置，创建和换源后都重设一遍。 */
  private applyPlaybackConfig(player: Player) {
    player.loop = true;
    player.playInBackground = false;
    player.playWhenInactive = false;
  }

  private setHolder(slot: CirclePoolSlot, holder: CirclePoolHolder) {
    const holders = [...this.store.getState().holders];
    holders[slot] = holder;
    this.store.setState({ holders });
    // claimOrder 只追踪当前被持有的 slot，作 FIFO 驱逐依据
    this.claimOrder =
      holder === null
        ? this.claimOrder.filter((item) => item !== slot)
        : [...this.claimOrder.filter((item) => item !== slot), slot];
  }

  private forEachHolder(
    callback: (holder: CirclePoolHolder, slot: CirclePoolSlot) => void,
  ) {
    this.store.getState().holders.forEach((holder, slot) => {
      callback(holder, slot as CirclePoolSlot);
    });
  }
}

/** 生产单例：播放器在首次 claim 时才创建，避免模块加载期触碰 Nitro。 */
export const circlePlayerPool = new CirclePlayerPool<VideoPlayer>(
  (source) => new VideoPlayerClass(source),
);
```

注意：`idle` 字面量 `[0, 1, 2] as CirclePoolSlot[]` 对应 `POOL_SIZE=3`；若调整池大小需同步。`store` 参数默认 `useCirclePlayerPoolStore`，测试注入独立 store。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/features/circle/circle-player-pool.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: 提交**

```bash
git add src/features/circle/circle-player-pool.ts src/features/circle/circle-player-pool.test.ts
git commit -m "feat(circle): 新增全局播放器池，三实例轮转与跨 feed 焦点仲裁"
```

---

### Task 2: 全链路接入（hook → CircleVideoPlayer 重写 → CircleVideoCard → 屏幕 → HomeScreen）

**Files:**
- Modify: `src/features/circle/circle-player-pool.ts`（追加 `usePooledCirclePlayer` hook）
- Rewrite: `src/features/circle/components/CircleVideoPlayer.tsx`
- Modify: `src/features/circle/components/CircleVideoCard.tsx`
- Modify: `src/features/circle/screens/CircleScreen.tsx`
- Modify: `src/features/circle/screens/CircleSearchResultsScreen.tsx`
- Modify: `src/features/circle/screens/CircleUserVideosScreen.tsx`
- Modify: `src/features/home/screens/HomeScreen.tsx:385`

**Interfaces:**
- Consumes: Task 1 的 `circlePlayerPool` / `useCirclePlayerPoolStore` / `CirclePoolSlot` / `CIRCLE_HOME_FEED_ID` / `PoolableVideoPlayer`。
- Produces: `usePooledCirclePlayer({ feedId, post, inWindow, preload, forceReload })` → `{ slot, player }`，供 `CircleVideoCard` 使用；`CircleVideoCard` 新增必填 prop `feedId: string`。

- [ ] **Step 1: 在池文件追加认领 hook**

```ts
// 追加到 src/features/circle/circle-player-pool.ts
import { useEffect, useState } from "react";

type UsePooledCirclePlayerOptions = {
  feedId: string;
  post: CirclePoolSource;
  /** 卡片是否在播放窗口内（active / preload / retain 之一）。 */
  inWindow: boolean;
  /** 是否预加载（下一页）。 */
  preload: boolean;
  /** 重试计数，变化时强制换源重载。 */
  forceReload?: number;
};

type PooledPlayerBinding = {
  slot: CirclePoolSlot | null;
  player: VideoPlayer | null;
};

/**
 * 卡片向全局池认领播放器。feed 失焦或离开窗口时自动释放；
 * claim/release 与 preload 拆成两个 effect，避免 preload 翻转造成认领抖动。
 */
export function usePooledCirclePlayer(options: UsePooledCirclePlayerOptions): PooledPlayerBinding {
  const { feedId, post, inWindow, preload, forceReload } = options;
  const feedActive = useCirclePlayerPoolStore((state) => state.activeFeedId === feedId);
  const [slot, setSlot] = useState<CirclePoolSlot | null>(null);

  useEffect(() => {
    if (!inWindow || !feedActive) {
      setSlot(null);
      return;
    }
    const claimed = circlePlayerPool.claim(feedId, post, { force: (forceReload ?? 0) > 0 });
    setSlot(claimed);
    return () => {
      if (claimed !== null) {
        circlePlayerPool.release(claimed, feedId, post.id);
      }
    };
  }, [feedId, post.id, post.videoUrl, inWindow, feedActive, forceReload]);

  useEffect(() => {
    if (slot !== null && preload) {
      circlePlayerPool.ensurePreload(slot);
    }
  }, [slot, preload]);

  const player = slot !== null ? circlePlayerPool.getPlayer(slot) : null;
  return { slot, player };
}
```

注意：顶部 `import { useEffect, useState } from "react"` 与文件已有 import 合并。`force` 传 `(forceReload ?? 0) > 0` 意味着重试后一直为 true——卡片重试成功一次后 `playError` 复位，但 forceReload 计数不清零，后续 claim 都会强制重载。**修正：force 仅在计数变化的那次生效**，把比较改为上一次计数：

```ts
  const prevForceRef = useRef(forceReload ?? 0);
  const force = (forceReload ?? 0) > prevForceRef.current;
  useEffect(() => {
    prevForceRef.current = forceReload ?? 0;
  }, [forceReload]);
```
effect 依赖 `forceReload` 变化即触发重认领，此时 `force=true` 只对那一次生效（下一轮渲染 force 已回 false）。hook 最终返回 `{ slot, player }`。

- [ ] **Step 2: 重写 CircleVideoPlayer（去 useVideoPlayer，接池实例）**

```tsx
// src/features/circle/components/CircleVideoPlayer.tsx 全量替换
import { useEvent, VideoView } from "react-native-video";
import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet } from "react-native";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { circlePlayerPool, type CirclePoolSlot } from "@/features/circle/circle-player-pool";
import { reportCircleVideoPlay } from "@/features/circle/circle.api";

type CircleVideoPlayerProps = {
  /** 池分配的播放器实例；父级保证非空才渲染本组件。 */
  player: NonNullable<ReturnType<typeof circlePlayerPool.getPlayer>>;
  slot: CirclePoolSlot;
  post: CircleVideoPost;
  active: boolean;
  shouldPlay: boolean;
  token?: string;
  /** 首帧真实渲染到画面后回调（依据 onProgress currentTime>0，而非 STATE_READY）。 */
  onFirstFrame: () => void;
  onError: () => void;
};

export function CircleVideoPlayer({
  player,
  slot,
  post,
  active,
  shouldPlay,
  token,
  onFirstFrame,
  onError,
}: CircleVideoPlayerProps) {
  const playedMs = useRef(0);
  const lastProgressAt = useRef<number | null>(null);
  const reported = useRef(false);
  const isPlayingRef = useRef(false);
  const frameShownRef = useRef(false);

  const handleProgress = useCallback(
    (progress: { currentTime: number }) => {
      const now = Date.now();
      // holdsSource 过滤换源期间的旧源进度：池内播放器可能刚被上一个视频复用
      if (
        active &&
        !frameShownRef.current &&
        progress.currentTime > 0 &&
        circlePlayerPool.holdsSource(slot, post.id)
      ) {
        frameShownRef.current = true;
        onFirstFrame();
      }
      if (active && isPlayingRef.current && lastProgressAt.current !== null) {
        const elapsed = now - lastProgressAt.current;
        if (elapsed > 0 && elapsed <= 1500) {
          playedMs.current += elapsed;
        }
        if (!reported.current && playedMs.current >= 3000 && token) {
          reported.current = true;
          void reportCircleVideoPlay({
            videoId: post.id,
            durationMs: Math.round(playedMs.current),
            token,
          });
        }
      }
      lastProgressAt.current = Number.isFinite(progress.currentTime) ? now : null;
    },
    [active, onFirstFrame, post.id, slot, token],
  );

  const handlePlaybackState = useCallback(
    (state: { isPlaying: boolean; isBuffering: boolean }) => {
      const playing = state.isPlaying && !state.isBuffering;
      isPlayingRef.current = playing;
      if (!playing) {
        lastProgressAt.current = null;
      }
    },
    [],
  );

  // useEvent 以 player 实例为依赖，池换绑后自动重订阅
  useEvent(player, "onProgress", handleProgress);
  useEvent(player, "onPlaybackStateChange", handlePlaybackState);
  useEvent(player, "onError", onError);

  useEffect(() => {
    if (!active) {
      // 离开本页后重置，回滑重新激活时再次等待首帧确认
      frameShownRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    if (active && shouldPlay) {
      player.play();
    } else {
      player.pause();
      lastProgressAt.current = null;
    }
  }, [active, player, shouldPlay]);

  useEffect(
    () => () => {
      if (!reported.current && playedMs.current >= 3000 && token) {
        void reportCircleVideoPlay({
          videoId: post.id,
          durationMs: Math.round(playedMs.current),
          token,
        });
      }
    },
    [post.id, token],
  );

  // 仍始终渲染 VideoView：窗口内卡片的绑定在翻页时不变，surface 提前建立
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      // 与封面 contentFit="cover" 保持一致，避免封面切换到视频时画面尺寸突变产生抖动
      resizeMode="cover"
      controls={false}
      keepScreenAwake={false}
      surfaceType={Platform.OS === "android" ? "texture" : undefined}
      pointerEvents="none"
    />
  );
}
```

`player` prop 类型用 `NonNullable<ReturnType<typeof circlePlayerPool.getPlayer>>`（即 `VideoPlayer`），避免重复 import 类型。

- [ ] **Step 3: CircleVideoCard 接入池**

`src/features/circle/components/CircleVideoCard.tsx` 修改点：

1. 新增 import：
```tsx
import { usePooledCirclePlayer } from "@/features/circle/circle-player-pool";
```
2. props 增加 `feedId: string`：
```tsx
type CircleVideoCardProps = {
  feedId: string;
  post: CircleVideoPost;
  /* 其余 props 不变 */
};
```
组件签名同步加 `feedId`。
3. 组件体内（`useRecyclingState` 区域之后）加认领：
```tsx
const { slot: poolSlot, player: poolPlayer } = usePooledCirclePlayer({
  feedId,
  post,
  inWindow: Boolean(post.videoUrl) && (active || shouldPreload || shouldRetain),
  preload: shouldPreload,
  forceReload: playerAttempt,
});
```
4. 替换 `CircleVideoPlayer` 渲染块（原 197-208 行）：
```tsx
{poolPlayer && poolSlot !== null ? (
  <CircleVideoPlayer
    key={`${post.id}:${poolSlot}:${playerAttempt}`}
    player={poolPlayer}
    slot={poolSlot}
    post={post}
    active={active}
    shouldPlay={active && playing}
    token={token ?? undefined}
    onFirstFrame={handlePlayerReady}
    onError={handlePlayerError}
  />
) : null}
```
原 `shouldPreload` prop 从 `CircleVideoPlayer` 的 props 中移除（预加载由 hook 的 `ensurePreload` 承担）。
5. 封面/`frameReadyRef` 逻辑不变：卡片失活（含 feed 失焦导致的 `active=false`）时封面复位，池释放期间 surface 上的旧画面被封面盖住。

- [ ] **Step 4: CircleScreen 接仲裁**

`src/features/circle/screens/CircleScreen.tsx`：

1. import 增加 `circlePlayerPool`、`CIRCLE_HOME_FEED_ID`。
2. `active` effect（放在 AppState effect 附近）：
```tsx
useEffect(() => {
  if (active) {
    circlePlayerPool.activateFeed(CIRCLE_HOME_FEED_ID);
  } else {
    circlePlayerPool.conditionalRelease(CIRCLE_HOME_FEED_ID);
  }
}, [active]);
```
3. `renderPost` 的 `<CircleVideoCard ... feedId={CIRCLE_HOME_FEED_ID} ... />`。
4. 其余逻辑（`shouldPlay` / `manualPlayback` / 翻页）不动。

- [ ] **Step 5: CircleSearchResultsScreen 与 CircleUserVideosScreen 接仲裁**

两个屏幕同样修改：

1. import 增加 `useFocusEffect`（来自 `expo-router`，已有 `router` 的 import 行合并）、`circlePlayerPool`。
2. 定义 feedId（组件体内，`useMemo`）：
```tsx
// CircleSearchResultsScreen.tsx
const feedId = useMemo(() => `circle-search:${keyword}`, [keyword]);
// CircleUserVideosScreen.tsx
const feedId = useMemo(() => `circle-user:${userId ?? "mine"}`, [userId]);
```
3. 焦点仲裁：
```tsx
useFocusEffect(
  useCallback(() => {
    circlePlayerPool.activateFeed(feedId);
    return () => {
      circlePlayerPool.conditionalRelease(feedId);
    };
  }, [feedId]),
);
```
4. 增加 `const focused = useIsFocused();`（`expo-router` 导出），卡片播控并入焦点：
```tsx
const feedActive = shouldPlay && focused;
```
`renderPost` 中原 `active={shouldPlay && ...}` / `shouldPreload={shouldPlay && ...}` / `shouldRetain={shouldPlay && ...}` 的 `shouldPlay` 全部替换为 `feedActive`，并新增 `feedId={feedId}`。
5. 语聊房 / AppState 的 `shouldPlay` 计算保持不变（仅作为 `feedActive` 的输入之一）。

- [ ] **Step 6: HomeScreen 传路由焦点**

`src/features/home/screens/HomeScreen.tsx:385`：
```tsx
// 修改前
<CircleScreen active={topTab === "circle"} bottomInset={insets.bottom} />
// 修改后
<CircleScreen active={topTab === "circle" && focused} bottomInset={insets.bottom} />
```
`focused`（`useIsFocused()`）已在组件内存在（第 45 行）。push `/circle/search` 等顶层路由时 Home tab 失焦 → CircleScreen `active=false` → `conditionalRelease` → 池释放主信息流持有权，新屏 `activateFeed` 接管同一批播放器。

- [ ] **Step 7: 全量静态检查**

Run: `npx vitest run src/features/circle`
Run: `npx tsc --noEmit`
Run: `npx expo lint`
Expected: 测试全部 PASS、无类型错误、无 lint 错误。注意：若 tsc 报路由类型错误（新增路由才有此问题，本任务不新增路由，一般不会触发）。

- [ ] **Step 8: 提交**

```bash
git add src/features/circle/circle-player-pool.ts src/features/circle/components/CircleVideoPlayer.tsx src/features/circle/components/CircleVideoCard.tsx src/features/circle/screens/CircleScreen.tsx src/features/circle/screens/CircleSearchResultsScreen.tsx src/features/circle/screens/CircleUserVideosScreen.tsx src/features/home/screens/HomeScreen.tsx
git commit -m "feat(circle): 视频卡片接入全局播放器池，焦点仲裁消除跨屏双声"
```

---

### Task 3: 验证与回归

**Files:** 无新文件。

- [ ] **Step 1: 全量单测**

Run: `npx vitest run`
Expected: 全部 PASS（含既有 circle 测试）。

- [ ] **Step 2: 真机场景清单（用户 APK 验收）**

逐项验证（核心是声音互斥与翻页体验不回退）：

1. 主信息流翻页 ≥10 页：切换顺滑、无黑屏闪烁、上滑下滑回滑秒恢复。
2. **声音重叠主场景**：主信息流播放中 → 点 #话题 → 话题页播放另一条视频 → 无双声；返回后原 feed 重新缓冲播放。
3. 话题页 → 点头像进作品页：无双声；逐层返回各层恢复播放。
4. 评论面板弹出/收起：视频持续播放不中断（sheet 不触发路由失焦）。
5. 加入语聊房：视频立即静音暂停；退出语聊房恢复。
6. 退后台再回前台、来电中断：恢复播放。
7. 断网/坏源：显示"播放失败，点击重试"，点击后经池强制换源重载成功。
8. 首屏首帧：封面淡出时机与改前一致（无旧画面闪现）。
9. Android（texture surface）与 iOS 各验一遍。

- [ ] **Step 3: 性能抽查（可选，Android）**

翻 10+ 页后用 Android Studio Memory Profiler 观察：播放器相关内存稳定不增长（池固定 3 实例），对比改造前每屏 3 实例、跨屏累积的行为。

---

## Self-Review 记录

- **Spec 覆盖**：双声主场景（Task 2 焦点仲裁）、多场景（tab 切换 / 语聊房 / 后台 / 评论 sheet / 逐层返回，均在 Task 3 清单）、抖音式池化（Task 1 轮转与驱逐）、性能（池 3 实例 + Task 3 抽查）——全覆盖。
- **类型一致性**：`claim/release/activateFeed/conditionalRelease/ensurePreload/holdsSource/getPlayer` 签名在 Task 1 定义、Task 2 使用处一致；`CircleVideoCardProps.feedId` 在 Task 2 内三屏全部传入。
- **已知取舍**（实现时不要再改）：跨屏返回会重新换源（HTTP 缓存兜底，抖音同款）；池实例 App 生命周期常驻（3 个，接受）；`replaceSourceAsync` 后重设 loop/playInBackground/playWhenInactive 防配置漂移。
