import { Dismiss24Regular } from "@fluentui/react-native-icons";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEvent, useVideoPlayer, VideoView } from "react-native-video";

function LocalVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri });
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => {
    setFailed(true);
  }, []);
  useEvent(player, "onError", handleError);

  useFocusEffect(
    useCallback(() => {
      player.play();
      return () => {
        player.pause();
      };
    }, [player]),
  );

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        controls
        resizeMode="contain"
      />
      {failed ? <Text style={styles.error}>视频播放失败</Text> : null}
    </>
  );
}

export default function CircleVideoPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { uri: routeUri } = useLocalSearchParams<{ uri?: string | string[] }>();
  const uri = Array.isArray(routeUri) ? routeUri[0] : routeUri;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {uri ? <LocalVideoPlayer uri={uri} /> : <Text style={styles.error}>视频不可用</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="关闭视频预览"
        onPress={router.back}
        style={[styles.close, { top: insets.top + 8 }]}
      >
        <Dismiss24Regular color="#FFFFFF" width={24} height={24} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  close: {
    position: "absolute",
    left: 16,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    position: "absolute",
    alignSelf: "center",
    color: "#FFFFFF",
    fontSize: 14,
  },
});
