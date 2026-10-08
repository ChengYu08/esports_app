import { Tabs, usePathname } from "expo-router";
import { AppTabBar } from "@/shared/ui/AppTabBar";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

export default function TabsLayout() {
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (
      Platform.OS !== "android" ||
      !["/", "/order", "/message", "/mine"].includes(pathname)
    ) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setExitPromptVisible(true);
        return true;
      },
    );
    return () => subscription.remove();
  }, [pathname]);

  return (
    <>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="order" />
        <Tabs.Screen name="message" />
        <Tabs.Screen name="mine" />
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
