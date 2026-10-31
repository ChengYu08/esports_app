import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";

type ActivityRulesModalProps = {
  visible: boolean;
  /** 服务端 jsoup 清洗过的活动规则 HTML；空内容时入口不渲染，组件不做兜底。 */
  rules: string;
  onClose: () => void;
};

/** 活动规则弹窗：Modal + react-native-render-html 渲染（组件自带默认标签白名单）。 */
export function ActivityRulesModal({ visible, rules, onClose }: ActivityRulesModalProps) {
  const { width } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>活动规则</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭活动规则" hitSlop={12} onPress={onClose}>
              <Text style={styles.closeText}>关闭</Text>
            </Pressable>
          </View>
          <RenderHTML
            contentWidth={width - 32}
            source={{ html: rules }}
            baseStyle={styles.rulesBase}
            tagsStyles={{ p: styles.rulesParagraph }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  closeText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#888888",
  },
  rulesBase: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
  },
  rulesParagraph: {
    marginTop: 0,
    marginBottom: 8,
  },
});
