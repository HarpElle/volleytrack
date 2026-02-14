import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { TeamStats } from '../../types/stats';

interface StatsSummaryProps {
    stats: TeamStats;
    targets?: any; // To compare vs benchmarks
}

export default function StatsSummary({ stats, targets, matchesWon }: StatsSummaryProps & { matchesWon?: number }) {
    const { colors } = useAppTheme();

    if (!stats) return null;

    const items = [
        ...(matchesWon !== undefined ? [{ label: 'Matches Won', value: matchesWon, sub: 'Event Total' }] : []),
        { label: 'Sets Won', value: stats.setsWon, sub: `Played: ${stats.setsPlayed}` },
        { label: 'Points', value: stats.totalPoints, sub: 'Total Scored' },
        { label: 'Aces', value: stats.aces, sub: `${(stats.serveAttempts > 0 ? (stats.aces / stats.serveAttempts * 100).toFixed(1) : 0)}%` },
        { label: 'Kills', value: stats.kills, sub: `Hit: ${(stats.attackAttempts > 0 ? ((stats.kills - stats.attackErrors) / stats.attackAttempts).toFixed(3) : '.000')}` },
        { label: 'Blocks', value: stats.soloBlocks + stats.assistBlocks, sub: 'Total' },
    ];

    return (
        <View style={styles.container}>
            {items.map((item, idx) => (
                <View key={idx} style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.value, { color: colors.text }]}>{item.value}</Text>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>{item.sub}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    card: {
        width: '31%', // 3 columns
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    value: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 2,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    sub: {
        fontSize: 10,
    },
});
