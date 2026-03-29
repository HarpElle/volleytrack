import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { useAppTheme } from '../contexts/ThemeContext';

export function CourtLoadingSkeleton() {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Skeleton width="100%" height={80} style={{ marginBottom: 12 }} />
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="30%" height={72} style={styles.cell} />
        ))}
      </View>
      <Skeleton width="100%" height={52} style={{ marginTop: 16 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cell: { borderRadius: 8 },
});
