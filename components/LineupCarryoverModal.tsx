/**
 * LineupCarryoverModal — Shown at the start of Set 2+ when the lineup
 * was automatically carried over from a previous set.
 *
 * Gives the coach the choice to:
 *   • Keep the carried-over lineup (possibly rotated)
 *   • Clear it and start fresh (assign players manually)
 */

import { RotateCw } from 'lucide-react-native';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { LineupPosition, Player } from '../types';

interface LineupCarryoverModalProps {
    visible: boolean;
    setNumber: number;
    /** The set number the lineup was carried from */
    sourceSetNumber: number;
    /** Whether the lineup was auto-rotated */
    wasRotated: boolean;
    /** Direction of rotation, if any */
    rotationDirection?: 'forward' | 'backward';
    /** The carried-over rotation so we can show a preview */
    rotation: LineupPosition[];
    /** Full roster for name lookups */
    roster: Player[];
    /** Keep the carried-over lineup */
    onKeep: () => void;
    /** Clear lineup and start fresh */
    onClear: () => void;
}

export default function LineupCarryoverModal({
    visible,
    setNumber,
    sourceSetNumber,
    wasRotated,
    rotationDirection,
    rotation,
    roster,
    onKeep,
    onClear,
}: LineupCarryoverModalProps) {
    const { colors, radius } = useAppTheme();

    const getPlayerLabel = (playerId: string | null) => {
        if (!playerId) return '—';
        const p = roster.find(r => r.id === playerId);
        return p ? `#${p.jerseyNumber} ${p.name.split(' ')[0]}` : '?';
    };

    // Sort by position for display
    const sorted = [...rotation]
        .filter(p => p.playerId)
        .sort((a, b) => a.position - b.position);

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, borderRadius: radius.xl }]}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        Set {setNumber} Lineup
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Carried over from Set {sourceSetNumber}
                        {wasRotated ? ` (rotated ${rotationDirection})` : ''}
                    </Text>

                    {/* Mini lineup preview */}
                    {sorted.length > 0 && (
                        <View style={[styles.previewContainer, { backgroundColor: colors.bg, borderColor: colors.border, borderRadius: radius.md }]}>
                            {sorted.map(slot => (
                                <View key={slot.position} style={styles.previewRow}>
                                    <Text style={[styles.posLabel, { color: colors.textTertiary }]}>
                                        P{slot.position}
                                    </Text>
                                    <Text style={[styles.playerLabel, { color: colors.text }]}>
                                        {getPlayerLabel(slot.playerId)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {wasRotated && (
                        <View style={styles.rotateHint}>
                            <RotateCw size={14} color={colors.textTertiary} />
                            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                                Rotation adjusted based on serve order
                            </Text>
                        </View>
                    )}

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                            onPress={onKeep}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.primaryBtnText, { color: colors.buttonPrimaryText }]}>
                                Use This Lineup
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.secondaryBtn, { backgroundColor: colors.buttonSecondary, borderRadius: radius.sm + 2 }]}
                            onPress={onClear}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                                Start Fresh
                            </Text>
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
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        padding: 24,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 16,
        textAlign: 'center',
    },
    previewContainer: {
        width: '100%',
        borderWidth: 1,
        padding: 12,
        marginBottom: 12,
        gap: 6,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    posLabel: {
        fontSize: 12,
        fontWeight: '700',
        width: 28,
    },
    playerLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    rotateHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    hintText: {
        fontSize: 12,
        fontWeight: '500',
    },
    actions: {
        width: '100%',
        gap: 10,
    },
    primaryBtn: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryBtnText: {
        fontSize: 17,
        fontWeight: '700',
    },
    secondaryBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
