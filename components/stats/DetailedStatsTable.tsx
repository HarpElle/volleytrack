import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { Player } from '../../types';
import { PlayerStats } from '../../types/stats';

interface DetailedStatsTableProps {
    playerStats: Record<string, PlayerStats>;
    roster: Player[];
}

export default function DetailedStatsTable({ playerStats, roster }: DetailedStatsTableProps) {
    const { colors } = useAppTheme();

    // Sort players: By total points, then Kills? Or Sets Played?
    // Default: Jersey Number
    // Or Points? Let's do Sets Played then Points as a good "Impact" sort default.

    const sortedStats = Object.values(playerStats).sort((a, b) => {
        // Sort active players first
        if (a.setsPlayed !== b.setsPlayed) return b.setsPlayed - a.setsPlayed;
        return b.totalPoints - a.totalPoints;
    });

    const getPlayerName = (id: string) => {
        const p = roster.find(r => r.id === id);
        return p ? `#${p.jerseyNumber} ${p.name.split(' ')[0]}` : 'Unknown';
    };

    const fmtHit = (k: number, e: number, att: number) => {
        if (att === 0) return '.000';
        const val = (k - e) / att;
        return val.toFixed(3).replace('0.', '.');
    };

    return (
        <ScrollView horizontal style={styles.container} showsHorizontalScrollIndicator={true}>
            <View>
                {/* Header */}
                <View style={[styles.row, styles.header, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.cell, styles.nameCell, styles.headerText, { color: colors.textSecondary }]}>Player</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>SP</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>K</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>E</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Att</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Hit%</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Ace</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>SE</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Dig</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Blk</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Ast</Text>
                    <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Pts</Text>
                </View>

                {/* Rows */}
                {sortedStats.map(stat => (
                    <View key={stat.playerId} style={[styles.row, styles.dataRow, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                        <Text style={[styles.cell, styles.nameCell, { color: colors.text }]}>{getPlayerName(stat.playerId)}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.setsPlayed}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.kills}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.attackErrors}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.attackAttempts}</Text>
                        <Text style={[styles.cell, { fontWeight: 'bold', color: colors.text }]}>{fmtHit(stat.kills, stat.attackErrors, stat.attackAttempts)}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.aces}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.serveErrors}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.digs}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.soloBlocks + stat.assistBlocks}</Text>
                        <Text style={[styles.cell, { color: colors.text }]}>{stat.assists}</Text>
                        <Text style={[styles.cell, { fontWeight: '800', color: colors.text }]}>{stat.totalPoints}</Text>
                        {/* Note: "Pts" traditionally usually means EARNED points (K+A+B). Error deduction is "+/-".
                            Let's revert to standard Points = K + A + B for "Pts" header.
                        */}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    header: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    dataRow: {},
    cell: {
        width: 40,
        textAlign: 'center',
        fontSize: 12,
    },
    nameCell: {
        width: 80,
        textAlign: 'left',
        paddingLeft: 8,
        fontWeight: '600',
    },
    headerText: {
        fontWeight: 'bold',
    },
});
