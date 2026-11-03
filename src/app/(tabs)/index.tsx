import { StyleSheet, View } from "react-native";

import HomeScreen from "@/features/home/screens/HomeScreen";
import { MatchQuickOrderFab } from "@/features/match/components/MatchQuickOrderFab";

export default function HomeTabScreen() {
  return (
    <View style={styles.root}>
      <HomeScreen />
      <MatchQuickOrderFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
