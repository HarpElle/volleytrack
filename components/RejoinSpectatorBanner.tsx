import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Eye, Radio, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { LAST_ACTIVE_SPECTATOR_KEY, LastActiveSpectator } from '../constants/spectator';
import { useAppTheme } from '../contexts/ThemeContext';
import { getLiveMatch } from '../services/firebase/liveMatchService';

export function RejoinSpectatorBanner() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const [session, setSession] = useState<LastActiveSpectator | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(LAST_ACTIVE_SPECTATOR_KEY);
      if (!raw) return;

      const parsed: LastActiveSpectator = JSON.parse(raw);

      if (Date.now() - parsed.lastSeen > 4 * 60 * 60 * 1000) {
        AsyncStorage.removeItem(LAST_ACTIVE_SPECTATOR_KEY);
        return;
      }

      const result = await getLiveMatch(parsed.matchCode);
      if (!result.success || !result.match?.isActive) {
        AsyncStorage.removeItem(LAST_ACTIVE_SPECTATOR_KEY);
        return;
      }

      setSession(parsed);
    })();
  }, []);

  if (!session) return null;

  const handleRejoin = () => {
    router.push(`/spectate/${session.matchCode}`);
  };

  const handleDismiss = () => {
    AsyncStorage.removeItem(LAST_ACTIVE_SPECTATOR_KEY);
    setSession(null);
  };

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      exiting={FadeOutUp.springify()}
      style={[styles.banner, { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: radius.md }]}
    >
      <Radio size={16} color={colors.primary} />
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.primary }]}>Match in progress</Text>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{session.matchName}</Text>
      </View>
      <TouchableOpacity
        style={[styles.rejoinBtn, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
        onPress={handleRejoin}
      >
        <Eye size={14} color="#fff" />
        <Text style={styles.rejoinText}>Rejoin</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDismiss} hitSlop={12}>
        <X size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  textBlock: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  rejoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rejoinText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
