import { useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  buildBirthdayColumns,
  clampDay,
  daysInMonth,
  parseBirth,
} from "@/features/mine/utils/birthday-columns";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 230，上下各留半行空白

const SELECTED_COLOR = "#0D0D0F";
const NEAR_COLOR = "#999999";
const FAR_COLOR = "#CACACA";

type Selection = { y: number; m: number; d: number };

/** 单列滚轮：ScrollView snapToInterval 定位，settle 后回调选中下标。 */
function WheelColumn({
  items,
  format,
  selectedIndex,
  onSelect,
}: {
  items: number[];
  format: (value: number) => string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const paddingVertical = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

  // 定位到选中项：初始挂载、列表长度变化（月切日钳制）、外部选中变化
  useEffect(() => {
    ref.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex, items.length]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.min(
      items.length - 1,
      Math.max(0, Math.round(y / ITEM_HEIGHT)),
    );
    if (index !== selectedIndex) {
      onSelect(index);
    }
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  };

  return (
    <View style={styles.column}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{
          paddingVertical,
        }}
      >
        {items.map((value, index) => {
          const distance = Math.abs(index - selectedIndex);
          const color =
            distance === 0
              ? SELECTED_COLOR
              : distance === 1
                ? NEAR_COLOR
                : FAR_COLOR;
          return (
            <View key={value} style={styles.item}>
              <Text style={[styles.itemText, { color }]}>{format(value)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * 生日选择底部滚轮弹层（设计稿 1535-181296）：
 * 取消 / 选择日期 / 确定 + 年月日三列滚轮，确定后回传 "YYYY-MM-DD"。
 */
export function BirthDatePickerSheet({
  visible,
  birth,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  /** 当前生日（YYYY-MM-DD），空则默认 2000-01-01。 */
  birth?: string | null;
  onConfirm: (birth: string) => void;
  onCancel: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(() =>
    parseBirth(birth, { y: 2000, m: 1, d: 1 }),
  );

  const today = useMemo(() => new Date(), []);
  const { years, months } = useMemo(
    () => buildBirthdayColumns(today),
    [today],
  );

  const dayCount = daysInMonth(selection.y, selection.m);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const dayIndex = Math.min(selection.d, dayCount) - 1;

  const yearIndex = Math.max(0, years.indexOf(selection.y));
  const monthIndex = selection.m - 1;

  const selectYear = (index: number) => {
    const y = years[index];
    setSelection((current) => ({
      y,
      m: current.m,
      d: clampDay(y, current.m, current.d),
    }));
  };

  const selectMonth = (index: number) => {
    const m = index + 1;
    setSelection((current) => ({
      y: current.y,
      m,
      d: clampDay(current.y, m, current.d),
    }));
  };

  const selectDay = (index: number) => {
    setSelection((current) => ({ ...current, d: index + 1 }));
  };

  const confirm = () => {
    const day = clampDay(selection.y, selection.m, selection.d);
    const mm = String(selection.m).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onConfirm(`${selection.y}-${mm}-${dd}`);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.sheetCard}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消"
          onPress={onCancel}
          style={styles.headerSide}
        >
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
        <Text style={styles.headerTitle}>选择日期</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="确定"
          onPress={confirm}
          style={styles.headerSide}
        >
          <Text style={styles.confirmText}>确定</Text>
        </Pressable>
      </View>
      <View style={styles.wheelArea}>
        <View style={styles.wheelRow}>
          <WheelColumn
            items={years}
            format={(value) => `${value}年`}
            selectedIndex={yearIndex}
            onSelect={selectYear}
          />
          <WheelColumn
            items={months}
            format={(value) => `${value}月`}
            selectedIndex={monthIndex}
            onSelect={selectMonth}
          />
          <WheelColumn
            items={days}
            format={(value) => `${value}日`}
            selectedIndex={dayIndex}
            onSelect={selectDay}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetCard: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
  },
  headerSide: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  cancelText: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  confirmText: {
    color: "#0D0D0F",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  wheelArea: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
  },
  wheelRow: {
    flexDirection: "row",
    height: WHEEL_HEIGHT,
  },
  column: {
    flex: 1,
    overflow: "hidden",
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
});
