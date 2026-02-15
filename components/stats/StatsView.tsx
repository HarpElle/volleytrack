import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { DEFAULT_TARGET_PROFILE } from '../../constants/Benchmarks';
import { Player, StatLog } from '../../types';
import { StatsEngine } from '../../utils/StatsEngine';
import ComparisonChart from './ComparisonChart';
import DetailedStatsTable from './DetailedStatsTable';
import Leaderboard from './Leaderboard';
import StatsSummary from './StatsSummary';

interface StatsViewProps {
    logs: StatLog[];
    roster: Player[];
    title?: string;
    matchesWon?: number;
}

export default function StatsView({ logs, roster, title = 'Match Stats', matchesWon }: StatsViewProps) {
    const { colors } = useAppTheme();

    // Calculate Stats — hooks must be called unconditionally (Rules of Hooks)
    const { teamStats, playerStats, advancedStats } = useMemo(() => {
        if (!logs || logs.length === 0) {
            return { teamStats: null, playerStats: null, advancedStats: null };
        }
        const tStats = StatsEngine.calculateTeamStats(logs);
        const pStats = StatsEngine.calculatePlayerStats(logs);
        const aStats = StatsEngine.calculateAdvancedTeamStats(logs);
        return { teamStats: tStats, playerStats: pStats, advancedStats: aStats };
    }, [logs]);

    if (!logs || logs.length === 0 || !teamStats) {
        return (
            <View style={[styles.empty, { backgroundColor: colors.bg }]}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No stats recorded yet.</Text>
            </View>
        );
    }

    // Calculate actual Hitting %
    const hittingPct = teamStats.attackAttempts > 0
        ? (teamStats.kills - teamStats.attackErrors) / teamStats.attackAttempts
        : 0;

    // Calculate Ace %
    const acePct = teamStats.serveAttempts > 0
        ? (teamStats.aces / teamStats.serveAttempts)
        : 0;

    // Target Profile (Hardcoded to default for now, could be passed as prop)
    const targets = DEFAULT_TARGET_PROFILE.targets;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.header, { color: colors.text }]}>{title}</Text>

            <StatsSummary stats={teamStats} matchesWon={matchesWon} />

            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Performance vs Targets</Text>
            <View style={styles.chartGrid}>
                <ComparisonChart
                    label="Hitting Efficiency"
                    actual={hittingPct}
                    target={targets.hittingPct}
                    formatValue={(v) => v.toFixed(3)}
                    maxValue={0.6}
                />
                <ComparisonChart
                    label="Sideout %"
                    actual={advancedStats.sideoutPct}
                    target={targets.sideoutPct}
                    formatValue={(v) => (v * 100).toFixed(1) + '%'}
                />
                <ComparisonChart
                    label="Point Scoring %"
                    actual={advancedStats.pointScoringPct}
                    target={targets.pointScoringPct}
                    formatValue={(v) => (v * 100).toFixed(1) + '%'}
                />
                <ComparisonChart
                    label="Ace %"
                    actual={acePct}
                    target={targets.serveAcePct}
                    formatValue={(v) => (v * 100).toFixed(1) + '%'}
                    maxValue={0.25}
                />
            </View>

            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Top Performers</Text>
            <Leaderboard playerStats={playerStats} roster={roster} />

            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Detailed Stats</Text>
            <DetailedStatsTable playerStats={playerStats} roster={roster} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginVertical: 12,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
    },
    chartGrid: {
        marginBottom: 16,
    }
});
