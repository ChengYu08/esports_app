import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import type { ReactNode } from "react";

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backIcon?: ImageSource;
  backIconColor?: string;
  right?: ReactNode;
  backgroundColor?: string;
  height?: number;
  titleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

const BACK_BUTTON_WIDTH = 48;

// 公共页头：标题绝对定位居中，左右两侧宽度不对称也不影响居中；
// 浮层 View 设 pointerEvents="none"，不遮挡两侧按钮的点击。
export function ScreenHeader({
  title,
  onBack,
  backIcon,
  backIconColor,
  right,
  backgroundColor = "#FFFFFF",
  height = 44,
  titleStyle,
  style,
}: ScreenHeaderProps) {
  const iconColor = backIconColor ?? "#0A0A0A";
  return (
    // 双层结构：根容器只吃 style 传入的 paddingTop/height/paddingHorizontal 等（顶部避让、总高、分隔线），
    // 行容器承载 back + right + titleWrap，高度由 height prop 提供（可被 style 覆盖总高后仍保持行高）。
    // 之所以必须分两层：titleWrap 绝对定位的基准是父级的 padding box（含 padding 区域）——
    // 若单层且 style 带 paddingTop（约 19 个页面传 insets.top 避让），标题会在"总高"上垂直居中，
    // 而返回键在 padding 之下的行内居中，导致标题比返回键行中心上移 insets.top/2（刘海屏约 23-30px）。
    // 挪到无 padding 的行容器后，titleWrap 的垂直中心永远与返回键行一致。
    // 横向：若 style 带 paddingHorizontal（对称），行容器被内缩，标题仍在内容区居中，水平居中不受影响。
    <View style={[styles.root, { backgroundColor, height }, style]}>
      <View style={[styles.row, { height }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          disabled={!onBack}
          hitSlop={8}
          onPress={onBack}
          style={[styles.back, !onBack && styles.backPlaceholder]}
        >
          {backIcon ? (
            <Image
              source={backIcon}
              style={[styles.backIcon, iconColor ? { tintColor: iconColor } : null]}
            />
          ) : (
            <ChevronLeft24Regular color={iconColor} width={24} height={24} />
          )}
        </Pressable>
        <View style={styles.right}>{right}</View>
        <View pointerEvents="none" style={styles.titleWrap}>
          <Text numberOfLines={1} style={[styles.title, titleStyle]}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 根容器：只留必要容器属性；高度由 inline height 提供，可被 style 覆盖为 insets.top + 44 等避让值
  root: {},
  // 行容器：内容行；高度用 inline height（默认 44，DispatchDetail 传 28 时行高 28、back 按钮 height "100%" 自动跟随）
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    width: BACK_BUTTON_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  backPlaceholder: {
    opacity: 0,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  // flex:1 让右侧插槽内容贴住右缘；无 right 内容时是空视图，不影响布局
  right: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  titleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: BACK_BUTTON_WIDTH,
  },
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    textAlign: "center",
  },
});
