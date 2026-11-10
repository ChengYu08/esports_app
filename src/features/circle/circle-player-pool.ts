import { create } from "zustand";
import { useEffect, useRef } from "react";
import type { VideoPlayer } from "react-native-video";
import { VideoPlayer as VideoPlayerClass } from "react-native-video";

export const CIRCLE_HOME_FEED_ID = "circle-home";

export type CirclePoolSlot = 0 | 1 | 2;

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
  /** FIFO 驱逐依据，只含当前被持有的 slot。 */
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
        void this.reload(existing as CirclePoolSlot, post);
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
    const slots = [0, 1, 2] as CirclePoolSlot[];
    // 1. 空闲且源匹配：返回场景零换源
    const freeMatch = slots.find(
      (slot) => holders[slot] === null && this.sourcePostIds[slot] === postId,
    );
    if (freeMatch !== undefined) {
      return freeMatch;
    }
    // 2. 其他 feed 的持有者：跨屏切换时直接收回
    const activeFeedId = this.store.getState().activeFeedId;
    const foreign = slots.find(
      (slot) => holders[slot] !== null && holders[slot]!.feedId !== activeFeedId,
    );
    if (foreign !== undefined) {
      return foreign;
    }
    // 3. 尚未创建播放器的空 slot：创建即带源，无需 replace
    const fresh = slots.find(
      (slot) => holders[slot] === null && this.players[slot] === null,
    );
    if (fresh !== undefined) {
      return fresh;
    }
    // 4. 任意空闲 slot：需要 replace 换源
    const free = slots.find((slot) => holders[slot] === null);
    if (free !== undefined) {
      return free;
    }
    // 5. 全忙：FIFO 驱逐最老认领（快速滚动下旧卡片尚未释放的兜底）
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

type UsePooledCirclePlayerOptions = {
  feedId: string;
  /** 与 CircleVideoPost 对齐：videoUrl 可能为空，认领前需自行保证 inWindow 已过滤。 */
  post: { id: string; videoUrl?: string };
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
 * 卡片向全局播放器池认领播放器。slot 不走本地 state，而是从 store 的 holders 派生：
 * 认领/释放更新 holders 后订阅方自动重渲染，避免 effect 内 setState 的级联渲染。
 * feed 失焦或离开窗口时由 effect cleanup 释放认领。
 */
export function usePooledCirclePlayer(options: UsePooledCirclePlayerOptions): PooledPlayerBinding {
  const { feedId, post, inWindow, preload, forceReload } = options;
  const feedActive = useCirclePlayerPoolStore((state) => state.activeFeedId === feedId);
  const slot = useCirclePlayerPoolStore((state) => {
    const index = state.holders.findIndex(
      (holder) => holder?.feedId === feedId && holder.postId === post.id,
    );
    return index >= 0 ? (index as CirclePoolSlot) : null;
  });
  const forceCount = forceReload ?? 0;
  // force 只在计数增长的那一次生效，避免后续每次重认领都强制换源
  const prevForceRef = useRef(0);

  useEffect(() => {
    const force = forceCount > prevForceRef.current;
    prevForceRef.current = forceCount;
    if (!inWindow || !feedActive) {
      return;
    }
    const claimed = circlePlayerPool.claim(
      feedId,
      { id: post.id, videoUrl: post.videoUrl ?? "" },
      { force },
    );
    return () => {
      if (claimed !== null) {
        circlePlayerPool.release(claimed, feedId, post.id);
      }
    };
  }, [feedId, post.id, post.videoUrl, inWindow, feedActive, forceCount]);

  useEffect(() => {
    if (slot !== null && preload) {
      circlePlayerPool.ensurePreload(slot);
    }
  }, [slot, preload]);

  const player = slot !== null ? circlePlayerPool.getPlayer(slot) : null;
  return { slot, player };
}
