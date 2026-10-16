import { router, Tabs } from "expo-router";
import { AppTabBar } from "@/shared/ui/AppTabBar";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { useAuthStore } from "@esports/auth";

export default function TabsLayout() {
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const isAuthenticated = useAuthStore(
    (state) => Boolean(state.accessToken && state.user),
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (router.canGoBack()) return false;

        setExitPromptVisible(true);
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="ranking" options={{ title: "排行榜" }} />
        <Tabs.Protected guard={isAuthenticated}>
          <Tabs.Screen name="order" />
          <Tabs.Screen name="message" />
          <Tabs.Screen name="mine" />
        </Tabs.Protected>
      </Tabs>
      <AppPrompt
        visible={exitPromptVisible}
        title="退出应用"
        message="确定要退出应用吗？"
        cancelText="取消"
        confirmText="退出"
        onCancel={() => setExitPromptVisible(false)}
        onConfirm={() => {
          setExitPromptVisible(false);
          BackHandler.exitApp();
        }}
      />
    </>
  );
}
