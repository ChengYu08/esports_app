import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  clearPendingActivityRules,
  getPendingActivityRules,
} from "@/features/activity/activity-rules-transfer";
import { showToast } from "@/shared/ui/app-toast";

const CONTENT_HORIZONTAL = 16;

/** 活动规则独立页：渲染落地页透传的 HTML，不请求详情。 */
export default function ActivityRulesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [rules] = useState(() => getPendingActivityRules());

  useEffect(() => {
    if (rules && rules.trim()) {
      return;
    }
    showToast("暂无规则");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [rules]);

  const goBack = () => {
    clearPendingActivityRules();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  if (!rules || !rules.trim()) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={12}
            onPress={goBack}
            style={styles.backButton}
          >
            <ChevronLeft24Regular color="#0D0D0F" width={24} height={24} style={styles.backIcon} />
          </Pressable>
          <Text style={styles.navTitle}>活动规则</Text>
          <View style={styles.navRight} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <RenderHTML
          contentWidth={width - CONTENT_HORIZONTAL * 2}
          source={{ html: rules }}
          baseStyle={styles.rulesBase}
          tagsStyles={{
            p: styles.rulesParagraph,
            h1: styles.rulesHeading,
            h2: styles.rulesHeading,
            h3: styles.rulesHeading,
            strong: styles.rulesStrong,
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  nav: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  navBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 56,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#0D0D0F",
    textAlign: "center",
  },
  navRight: {
    width: 56,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CONTENT_HORIZONTAL,
    paddingTop: 16,
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
  rulesHeading: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: "#0D0D0F",
    marginTop: 12,
    marginBottom: 8,
  },
  rulesStrong: {
    fontWeight: "600",
  },
});
