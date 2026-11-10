import { create } from "zustand";
import { describe, expect, it, vi } from "vitest";

// 生产单例顶层导入了 react-native-video 的 VideoPlayer 类，node 环境无法解析其平台产物，这里用桩替换
vi.mock("react-native-video", () => ({
  VideoPlayer: class MockVideoPlayer {
    constructor(_source: unknown) {}
  },
}));

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

  it("全部 slot 被同 feed 持有时按 FIFO 驱逐最老认领", async () => {
    const { pool, store } = setup();
    pool.activateFeed("feed-a");
    const slot1 = pool.claim("feed-a", post("1"));
    const slot2 = pool.claim("feed-a", post("2"));
    const slot3 = pool.claim("feed-a", post("3"));
    // 快速滚动场景：新 post 4 在旧卡片 cleanup 释放之前抢先 claim
    const slot4 = pool.claim("feed-a", post("4"));
    await flush();
    const holder = store.getState().holders[slot4!];
    expect(holder).toEqual({ feedId: "feed-a", postId: "4" });
    // 被驱逐的是最老认领的 slot1
    expect(slot4).toBe(slot1);
    expect(slot2).not.toBe(slot4);
    expect(slot3).not.toBe(slot4);
  });
});
