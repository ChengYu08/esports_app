import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionNoticeBar } from "./ActionNoticeBar";
import {
  ACTION_NOTICE_STACK_OFFSET,
  actionNotice,
  getActionNoticeHandlers,
  useActionNoticeStore,
} from "./action-notice-store";

export function ActionNoticeHost() {
  const items = useActionNoticeStore((state) => state.items);
  const [claimingIds, setClaimingIds] = useState<ReadonlySet<string>>(() => new Set());

  const setClaiming = useCallback((id: string, claiming: boolean) => {
    setClaimingIds((prev) => {
      const next = new Set(prev);
      if (claiming) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {items.map((item, index) => (
        <ActionNoticeBar
          key={item.id}
          actionText={item.actionText}
          claiming={claimingIds.has(item.id)}
          expireAt={item.expireAt}
          extraBottomOffset={index * ACTION_NOTICE_STACK_OFFSET}
          icon={item.icon}
          maxDurationMs={item.maxDurationMs}
          minDurationMs={item.minDurationMs}
          text={item.text}
          onDismiss={() => actionNotice.dismiss(item.id)}
          onPressAction={() => {
            if (claimingIds.has(item.id)) return;
            const handlers = getActionNoticeHandlers(item.id);
            if (!handlers) return;
            setClaiming(item.id, true);
            void Promise.resolve(handlers.onAction()).finally(() => {
              setClaiming(item.id, false);
            });
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
});
