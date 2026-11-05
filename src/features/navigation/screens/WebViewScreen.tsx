import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WEBVIEW_COMPAT_SCRIPT } from "@/shared/navigation/webview-compat-script";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export default function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const [loading, setLoading] = useState(true);

  if (!url) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={title ?? ""}
        onBack={() => router.back()}
        titleStyle={styles.headerTitle}
        style={{
          paddingTop: insets.top,
          height: insets.top + 44,
          paddingHorizontal: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "#EBEBEB",
        }}
      />
      <View style={styles.content}>
        <WebView
          source={{ uri: url }}
          style={styles.webView}
          injectedJavaScriptBeforeContentLoaded={WEBVIEW_COMPAT_SCRIPT}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
        />
        {loading ? (
          <View style={styles.loadingMask} pointerEvents="none">
            <ActivityIndicator color="#FE1F4C" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  headerTitle: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  content: { flex: 1 },
  webView: { flex: 1, backgroundColor: "#FFF" },
  loadingMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
});
