import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Player } from '../../types';
import { PlayerStats } from '../../types/stats';

interface DetailedStatsTableProps {
    playerStats: Record<string, PlayerStats>;
    roster: Player[];
}

export default function DetailedStatsTable({ playerStats, roster }: DetailedStatsTableProps) {
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
                <View style={[styles.row, styles.header]}>
                    <Text style={[styles.cell, styles.nameCell, styles.headerText]}>Player</Text>
                    <Text style={[styles.cell, styles.headerText]}>SP</Text>
                    <Text style={[styles.cell, styles.headerText]}>K</Text>
                    <Text style={[styles.cell, styles.headerText]}>E</Text>
                    <Text style={[styles.cell, styles.headerText]}>Att</Text>
                    <Text style={[styles.cell, styles.headerText]}>Hit%</Text>
                    <Text style={[styles.cell, styles.headerText]}>Ace</Text>
                    <Text style={[styles.cell, styles.headerText]}>SE</Text>
                    <Text style={[styles.cell, styles.headerText]}>Dig</Text>
                    <Text style={[styles.cell, styles.headerText]}>Blk</Text>
                    <Text style={[styles.cell, styles.headerText]}>Ast</Text>
                    <Text style={[styles.cell, styles.headerText]}>Pts</Text>
                </View>

                {/* Rows */}
                {sortedStats.map(stat => (
                    <View key={stat.playerId} style={[styles.row, styles.dataRow]}>
                        <Text style={[styles.cell, styles.nameCell]}>{getPlayerName(stat.playerId)}</Text>
                        <Text style={styles.cell}>{stat.setsPlayed}</Text>
                        <Text style={styles.cell}>{stat.kills}</Text>
                        <Text style={styles.cell}>{stat.attackErrors}</Text>
                        <Text style={styles.cell}>{stat.attackAttempts}</Text>
                        <Text style={[styles.cell, { fontWeight: 'bold' }]}>{fmtHit(stat.kills, stat.attackErrors, stat.attackAttempts)}</Text>
                        <Text style={styles.cell}>{stat.aces}</Text>
                        <Text style={styles.cell}>{stat.serveErrors}</Text>
                        <Text style={styles.cell}>{stat.digs}</Text>
                        <Text style={styles.cell}>{stat.soloBlocks + stat.assistBlocks}</Text>
                        <Text style={styles.cell}>{stat.assists}</Text>
                        <Text style={[styles.cell, { fontWeight: '800' }]}>{stat.totalPoints}</Text>
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
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#f5f5f5',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    dataRow: {
        backgroundColor: '#fff',
    },
    cell: {
        width: 40,
        textAlign: 'center',
        fontSize: 12,
        color: '#333',
    },
    nameCell: {
        width: 80,
        textAlign: 'left',
        paddingLeft: 8,
        fontWeight: '600',
    },
    headerText: {
        fontWeight: 'bold',
        color: '#666',
    },
});
