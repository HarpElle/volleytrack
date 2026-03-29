import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, MapPin, Zap } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppTheme } from '../contexts/ThemeContext';
import { Event } from '../types';
import { getEventGroup } from '../utils/eventUtils';

interface ActiveEventCardProps {
  event: Event;
}

export function ActiveEventCard({ event }: ActiveEventCardProps) {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const group = getEventGroup(event);
  const isLive = group === 'now';

  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(0);
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
    opacity.value = withSpring(1);
  }, [translateY, opacity]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle} entering={FadeInDown.springify()}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isLive ? colors.successLight : colors.bgCard,
            borderColor: isLive ? colors.success : colors.border,
            borderRadius: radius.lg,
          },
        ]}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
        activeOpacity={0.8}
      >
        <View style={styles.left}>
          <View style={styles.labelRow}>
            {isLive ? (
              <View style={[styles.livePill, { backgroundColor: colors.success }]}>
                <Zap size={10} color="#fff" fill="#fff" />
                <Text style={styles.livePillText}>Now</Text>
              </View>
            ) : (
              <View style={[styles.livePill, { backgroundColor: colors.primaryLight }]}>
                <Calendar size={10} color={colors.primary} />
                <Text style={[styles.livePillText, { color: colors.primary }]}>Today</Text>
              </View>
            )}
          </View>
          <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
            {event.name}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.textTertiary} />
            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>
        <View style={[styles.enterBtn, { backgroundColor: colors.primary, borderRadius: radius.sm }]}>
          <Text style={styles.enterBtnText}>Enter</Text>
          <ChevronRight size={14} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  left: { flex: 1, gap: 3 },
  labelRow: { flexDirection: 'row', marginBottom: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  livePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  eventName: { fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12 },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
  },
  enterBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
