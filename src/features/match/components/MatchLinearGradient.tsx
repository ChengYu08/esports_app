import { useId, useState, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

type MatchLinearGradientProps = {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * 用 SVG 画线性渐变，避免 expo-linear-gradient 在 Fabric replace 时
 * “View already has a parent” 崩溃。
 */
export function MatchLinearGradient({
  colors,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
  style,
  children,
}: MatchLinearGradientProps) {
  const gradId = useId().replace(/:/g, "");
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const last = Math.max(colors.length - 1, 1);

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          width={size.width}
          height={size.height}
          style={styles.svg}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient
              id={gradId}
              x1={`${start.x * 100}%`}
              y1={`${start.y * 100}%`}
              x2={`${end.x * 100}%`}
              y2={`${end.y * 100}%`}
            >
              {colors.map((color, index) => (
                <Stop
                  key={`${color}-${index}`}
                  offset={`${(index / last) * 100}%`}
                  stopColor={color}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={`url(#${gradId})`}
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
  },
  svg: {
    ...StyleSheet.absoluteFill,
  },
});
