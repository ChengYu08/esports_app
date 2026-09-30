import { Tabs } from "expo-router";
import { AppTabBar } from "@/shared/ui/AppTabBar";

export default function TabsLayout() {
  return (
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
  );
}
