/**
 * PlayerSetSummary — Shows end-of-set stats for the spectator's cheered-for
 * player(s). Appears as a card when a set ends, with share capability.
 *
 * Computed from the match history by filtering for the player's stats
 * in the completed set.
 */

import { Share2, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { Player, StatLog } from '../../types';

const STAT_DISPLAY: Record<string, { emoji: string; label: string }> = {
    ace: { emoji: '🎯', label: 'Aces' },
    kill: { emoji: '💥', label: 'Kills' },
    block: { emoji: '🧱', label: 'Blocks' },
    dig: { emoji: '🦵', label: 'Digs' },
    serve_good: { emoji: '🏐', label: 'Good Serves' },
    attack_good: { emoji: '💫', label: 'Good Attacks' },
    receive_3: { emoji: '✅', label: 'Perfect Passes' },
    receive_2: { emoji: '👍', label: 'Good Passes' },
    serve_error: { emoji: '❌', label: 'Serve Errors' },
    attack_error: { emoji: '❌', label: 'Attack Errors' },
};

interface PlayerSetSummaryProps {
    visible: boolean;
    onClose: () => void;
    player: Player;
    setNumber: number;
    history: StatLog[];
    teamName: string;
    matchCode: string;
}

export function PlayerSetSummary({
    visible,
    onClose,
    player,
    setNumber,
    history,
    teamName,
    matchCode,
}: PlayerSetSummaryProps) {
    const { colors, radius } = useAppTheme();

    // Compute player's stats for this set
    const setEvents = history.filter(
        (e) => e.setNumber === setNumber && e.playerId === player.id && e.team === 'myTeam'
    );

    // Group by type and count
    const statCounts: Record<string, number> = {};
    for (const event of setEvents) {
        statCounts[event.type] = (statCounts[event.type] || 0) + 1;
    }

    // Only show stats we have display info for, with count > 0
    const displayStats = Object.entries(statCounts)
        .filter(([type]) => STAT_DISPLAY[type])
        .map(([type, count]) => ({
            type,
            count,
            ...STAT_DISPLAY[type],
        }))
        .sort((a, b) => b.count - a.count);

    const playerTag = player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name;

    const handleShare = async () => {
        const statLines = displayStats
            .map((s) => `${s.emoji} ${s.count} ${s.label}`)
            .join('\n');

        const message = `🏐 Set ${setNumber} Summary for ${playerTag}\n${statLines || 'Great hustle!'}\n\nWatching ${teamName} on VolleyTrack: ${matchCode}`;

        try {
            await Share.share({ message });
        } catch (_) {}
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            Set {setNumber} Summary for {playerTag}
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <X size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Stats */}
                    {displayStats.length > 0 ? (
                        <View style={styles.statsList}>
                            {displayStats.map((stat) => (
                                <View
                                    key={stat.type}
                                    style={[styles.statRow, { borderBottomColor: colors.border }]}
                                >
                                    <Text style={styles.statEmoji}>{stat.emoji}</Text>
                                    <Text style={[styles.statCount, { color: colors.text }]}>{stat.count}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                        {stat.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.noStats}>
                            <Text style={[styles.noStatsText, { color: colors.textTertiary }]}>
                                Great hustle this set! 💪
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.shareBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                            onPress={handleShare}
                            activeOpacity={0.7}
                        >
                            <Share2 size={16} color="#fff" />
                            <Text style={styles.shareText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.closeBtn, { borderColor: colors.border, borderRadius: radius.md }]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.closeText, { color: colors.textSecondary }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        flex: 1,
        marginRight: 12,
    },
    statsList: {
        gap: 2,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    statEmoji: {
        fontSize: 18,
        width: 28,
        textAlign: 'center',
    },
    statCount: {
        fontSize: 18,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        width: 28,
        textAlign: 'right',
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    noStats: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    noStatsText: {
        fontSize: 15,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    shareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    shareText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    closeBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderWidth: 1,
    },
    closeText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
