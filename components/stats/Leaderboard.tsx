import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { Player } from '../../types';
import { PlayerStats } from '../../types/stats';

interface LeaderboardProps {
    playerStats: Record<string, PlayerStats>;
    roster: Player[];
}

export default function Leaderboard({ playerStats, roster }: LeaderboardProps) {
    const { colors } = useAppTheme();

    const getTopPlayers = (metric: keyof PlayerStats, sortMetric?: keyof PlayerStats, limit: number = 3) => {
        const candidates = Object.values(playerStats).filter(p => (p[metric] as number) > 0 || (sortMetric && (p[sortMetric] as number) > 0));
        const sorter = sortMetric || metric;
        return candidates
            .sort((a, b) => {
                const valA = sorter === 'unforcedErrors' ? (a.totalPoints - a.unforcedErrors) : (a[sorter] as number);
                const valB = sorter === 'unforcedErrors' ? (b.totalPoints - b.unforcedErrors) : (b[sorter] as number);
                return valB - valA;
            })
            .slice(0, limit);
    };

    // Metrics Helpers
    const getHitEff = (p: PlayerStats) => p.attackAttempts > 0 ? ((p.kills - p.attackErrors) / p.attackAttempts).toFixed(3) : '.000';
    const getServeRating = (p: PlayerStats) => p.serveAttempts > 0 ? (p.serveRatingTotal / p.serveAttempts).toFixed(2) : '-';
    const getPlusMinus = (p: PlayerStats) => p.totalPoints - p.unforcedErrors;

    const renderCard = (title: string, players: PlayerStats[], getValue: (p: PlayerStats) => string | number, isMain: boolean = false) => {
        return (
            <View style={[styles.card, isMain && styles.mainCard, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>{title}</Text>
                {players.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>-</Text>
                ) : (
                    players.map((p, idx) => {
                        const player = roster.find(r => r.id === p.playerId);
                        const name = player ? `${player.name.split(' ')[0]}` : 'Unknown';
                        const number = player ? `#${player.jerseyNumber}` : '';

                        return (
                            <View key={p.playerId} style={[styles.row, idx !== players.length - 1 && styles.borderBottom, idx !== players.length - 1 && { borderBottomColor: colors.border }]}>
                                <View style={styles.playerInfo}>
                                    <View style={[styles.rankBadge, idx === 0 && styles.goldBadge, idx !== 0 && { backgroundColor: colors.buttonSecondary }]}>
                                        <Text style={[styles.rankText, idx === 0 && styles.goldText, idx !== 0 && { color: colors.textTertiary }]}>{idx + 1}</Text>
                                    </View>
                                    <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>{number} {name}</Text>
                                </View>
                                <Text style={[styles.value, { color: colors.text }]}>{getValue(p)}</Text>
                            </View>
                        );
                    })
                )}
            </View>
        );
    };

    // Sorting Lists
    const topPlusMinus = Object.values(playerStats).sort((a, b) => getPlusMinus(b) - getPlusMinus(a)).slice(0, 3).filter(p => getPlusMinus(p) !== 0);
    const topPoints = getTopPlayers('totalPoints');

    // Serving
    const topAces = getTopPlayers('aces');
    const topServeRating = Object.values(playerStats).filter(p => p.serveAttempts >= 3).sort((a, b) => (b.serveRatingTotal / b.serveAttempts) - (a.serveRatingTotal / a.serveAttempts)).slice(0, 3);

    // Attacking
    const topKills = getTopPlayers('kills');
    const topEff = Object.values(playerStats).filter(p => p.attackAttempts >= 3).sort((a, b) => ((b.kills - b.attackErrors) / b.attackAttempts) - ((a.kills - a.attackErrors) / a.attackAttempts)).slice(0, 3);

    // Defense
    const topBlocks = Object.values(playerStats).sort((a, b) => (b.soloBlocks + b.assistBlocks) - (a.soloBlocks + a.assistBlocks)).slice(0, 3).filter(p => (p.soloBlocks + p.assistBlocks) > 0);
    const topDigs = getTopPlayers('digs');

    return (
        <View style={styles.container}>
            {/* Row 1: Overall */}
            <View style={styles.gridRow}>
                {renderCard('Impact (+/-)', topPlusMinus, (p) => getPlusMinus(p), true)}
                {renderCard('Total Points', topPoints, (p) => p.totalPoints, true)}
            </View>

            {/* Row 2: Serving */}
            <View style={styles.gridRow}>
                {renderCard('Aces', topAces, (p) => p.aces)}
                {renderCard('Serve Rating', topServeRating, (p) => getServeRating(p))}
            </View>

            {/* Row 3: Attacking */}
            <View style={styles.gridRow}>
                {renderCard('Kills', topKills, (p) => p.kills)}
                {renderCard('Attack Eff.', topEff, (p) => getHitEff(p))}
            </View>

            {/* Row 4: Defense */}
            <View style={styles.gridRow}>
                {renderCard('Blocks', topBlocks, (p) => p.soloBlocks + p.assistBlocks)}
                {renderCard('Digs', topDigs, (p) => p.digs)}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
        marginBottom: 12,
    },
    gridRow: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        minHeight: 110,
    },
    mainCard: {},
    cardTitle: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyText: {
        fontSize: 12,
        textAlign: 'center',
        paddingVertical: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    borderBottom: {
        borderBottomWidth: 1,
    },
    playerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 8,
    },
    rankBadge: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    goldBadge: {
        backgroundColor: '#fff9c4',
    },
    rankText: {
        fontSize: 10,
        fontWeight: '700',
    },
    goldText: {
        color: '#fbc02d',
    },
    playerName: {
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1,
    },
    value: {
        fontSize: 14,
        fontWeight: '800',
        minWidth: 30,
        textAlign: 'right',
    },
});
