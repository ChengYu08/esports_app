import { useAuthStore } from "@esports/auth";
import { useEffect, useState } from "react";

import { readBlacklist, subscribeBlacklist, type BlacklistEntry } from "@/features/mine/blacklist";

const EMPTY_IDS = new Set<string>();

/** 订阅黑名单变更，让各处盼友圈视频即时隐藏被拉黑作者。 */
export function useCircleBlockedUserIds(): Set<string> | null {
  const token = useAuthStore((state) => state.accessToken);
  const [snapshot, setSnapshot] = useState<{ token: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    let changed = false;
    const update = (entries: BlacklistEntry[]) => {
      if (active) {
        setSnapshot({ token, ids: new Set(entries.map((entry) => entry.userId)) });
      }
    };
    const unsubscribe = subscribeBlacklist((entries) => {
      changed = true;
      update(entries);
    });

    readBlacklist()
      .then((entries) => {
        if (!changed) {
          update(entries);
        }
      })
      .catch(() => {
        if (!changed) {
          update([]);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [token]);

  if (!token) {
    return EMPTY_IDS;
  }
  return snapshot?.token === token ? snapshot.ids : null;
}
