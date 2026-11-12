import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircleScreen } from "@/features/circle/screens/CircleScreen";

export default function CircleTabScreen() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  return <CircleScreen active={focused} bottomInset={insets.bottom} />;
}
