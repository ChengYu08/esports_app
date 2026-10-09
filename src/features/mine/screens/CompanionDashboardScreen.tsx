import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '@esports/auth';
import { Stack, router } from 'expo-router';
import type { CompanionGame, CompanionService } from '@/types/companion';

export default function CompanionDashboardScreen() {
  const { companionProfile } = useAuthStore();

  if (!companionProfile) {
    router.replace('/');
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: '陪玩管理' }} />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>俱乐部信息</Text>
          {companionProfile.clubName && (
            <Text style={styles.clubName}>{companionProfile.clubName}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>游戏列表</Text>
          {companionProfile.gameList?.map((game: CompanionGame) => (
            <View key={game.gameId} style={styles.gameItem}>
              <Text style={styles.gameName}>{game.gameName}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务报价</Text>
          {companionProfile.services?.map((service: CompanionService) => (
            <View key={service.serviceId} style={styles.serviceItem}>
              <Text style={styles.serviceName}>{service.serviceName}</Text>
              <Text style={styles.servicePrice}>¥{service.price}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  clubName: {
    fontSize: 15,
    color: '#666',
  },
  gameItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  gameName: {
    fontSize: 15,
    color: '#333',
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  serviceName: {
    fontSize: 15,
    color: '#333',
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e01b28',
  },
});
