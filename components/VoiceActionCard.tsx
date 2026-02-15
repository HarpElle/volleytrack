import { AlertCircle, Check, HelpCircle, Trash2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { ParsedVoiceAction } from '../services/ai/VoiceParsingService';

// ── Color mapping for stat types ─────────────────────────────────────────────

const STAT_COLORS: Record<string, string> = {
    ace: '#2196f3',
    serve_good: '#4caf50',
    serve_error: '#f44336',
    kill: '#4caf50',
    attack_good: '#8bc34a',
    attack_error: '#f44336',
    block: '#009688',
    dig: '#bd10e0',
    dig_error: '#f44336',
    receive_3: '#4caf50',
    receive_2: '#8bc34a',
    receive_1: '#ffc107',
    receive_error: '#e91e63',
    receive_0: '#f44336',
    set_error: '#9c27b0',
    pass_error: '#e91e63',
    drop: '#f44336',
};

const STAT_LABELS: Record<string, string> = {
    ace: 'Ace',
    serve_good: 'Serve Good',
    serve_error: 'Serve Error',
    kill: 'Kill',
    attack_good: 'Attack Good',
    attack_error: 'Attack Error',
    block: 'Block',
    dig: 'Dig',
    dig_error: 'Dig Error',
    receive_3: 'Receive (3 - Perfect)',
    receive_2: 'Receive (2 - Good)',
    receive_1: 'Receive (1 - Poor)',
    receive_error: 'Receive Error',
    receive_0: 'Receive Error (Point)',
    set_error: 'Set Error',
    pass_error: 'Pass Error',
    drop: 'Drop',
};

// ── Component ────────────────────────────────────────────────────────────────

interface VoiceActionCardProps {
    action: ParsedVoiceAction;
    index: number;
    onRemove: (index: number) => void;
}

export function VoiceActionCard({ action, index, onRemove }: VoiceActionCardProps) {
    const { colors, radius } = useAppTheme();

    const statColor = STAT_COLORS[action.type] || colors.textSecondary;
    const statLabel = STAT_LABELS[action.type] || action.type.replace(/_/g, ' ').toUpperCase();
    const isOpponent = action.team === 'opponent';

    const ConfidenceIcon = action.confidence === 'high' ? Check
        : action.confidence === 'medium' ? HelpCircle
            : AlertCircle;

    const confidenceColor = action.confidence === 'high' ? '#22C55E'
        : action.confidence === 'medium' ? '#F59E0B'
            : '#EF4444';

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderRadius: radius.md, borderLeftColor: statColor }]}>
            <View style={styles.cardContent}>
                {/* Action Type Badge */}
                <View style={[styles.typeBadge, { backgroundColor: statColor + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: statColor }]}>{statLabel}</Text>
                </View>

                {/* Player Attribution */}
                <View style={styles.playerRow}>
                    {isOpponent ? (
                        <Text style={[styles.playerText, { color: colors.opponent || '#cc0033' }]}>Opponent</Text>
                    ) : action.playerLabel ? (
                        <Text style={[styles.playerText, { color: colors.text }]}>{action.playerLabel}</Text>
                    ) : (
                        <Text style={[styles.playerText, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                            No player attributed
                        </Text>
                    )}

                    {/* Confidence indicator */}
                    <ConfidenceIcon size={14} color={confidenceColor} />
                </View>

                {/* Assist attribution */}
                {action.assistPlayerLabel && (
                    <Text style={[styles.assistText, { color: colors.textSecondary }]}>
                        Set by {action.assistPlayerLabel}
                    </Text>
                )}
            </View>

            {/* Delete button */}
            <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.bg }]}
                onPress={() => onRemove(index)}
                hitSlop={8}
            >
                <Trash2 size={16} color={colors.textTertiary} />
            </TouchableOpacity>
        </View>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingLeft: 14,
        marginBottom: 8,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
    },
    cardContent: {
        flex: 1,
        gap: 4,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    playerText: {
        fontSize: 15,
        fontWeight: '600',
    },
    assistText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    deleteBtn: {
        padding: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
});
