import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type HomeBackgroundProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Decorative top background for the home screen.
 *
 * The artwork is intentionally larger than the viewport (631 x 372.6) so the
 * two soft colour blooms remain visible on smaller phones while the rest of
 * the page stays white.
 */
export function HomeBackground({ style }: HomeBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={styles.artboard}>
        <LinearGradient
          colors={["#FFE9EC", "#FFFDFD", "#F0FCFC"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.baseGradient}
        />
        <LinearGradient
          colors={[
            "rgba(255, 71, 84, 0.16)",
            "rgba(255, 235, 236, 0.08)",
            "transparent",
          ]}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.leftBloom}
        />
        <LinearGradient
          colors={[
            "rgba(113, 108, 255, 0.13)",
            "rgba(204, 203, 191, 0.06)",
            "transparent",
          ]}
          locations={[0, 0.38, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.rightBloom}
        />
        <LinearGradient
          colors={["transparent", "rgba(255, 255, 255, 0.88)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0, y: 1 }}
          style={styles.bottomFade}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 224,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  artboard: {
    position: "absolute",
    width: 631,
    height: 372.6,
    left: "50%",
    top: -93.3,
    marginLeft: -315.5,
    transform: [{ scaleY: -1 }],
  },
  baseGradient: {
    position: "absolute",
    width: "100%",
    height: "100%",
    left: 0,
    top: 0,
  },
  leftBloom: {
    position: "absolute",
    width: "68%",
    height: "82%",
    left: "-7%",
    top: 0,
    borderRadius: 999,
  },
  rightBloom: {
    position: "absolute",
    width: "68%",
    height: "82%",
    right: "-7%",
    top: 0,
    borderRadius: 999,
  },
  bottomFade: {
    position: "absolute",
    width: "100%",
    height: "75%",
    left: 0,
    bottom: 0,
  },
});
