import { ChevronDown, ChevronUp, Lock, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { LineupPosition, Player } from '../types';

interface SubstituteModalContentProps {
    subPicker: { visible: boolean; position: number } | null;
    roster: Player[];
    currentRotation: LineupPosition[] | undefined;
    subPairs: Record<string, string> | undefined;
    liberoIds: string[] | undefined;
    nonLiberoDesignations: string[];
    onClose: () => void;
    onSub: (player: Player, isLibero?: boolean) => void;
    onDesignateNonLibero: (playerId: string) => void;
}

export function SubstituteModalContent({
    subPicker,
    roster,
    currentRotation,
    subPairs,
    liberoIds,
    nonLiberoDesignations,
    onClose,
    onSub,
    onDesignateNonLibero
}: SubstituteModalContentProps) {
    const [showIneligible, setShowIneligible] = useState(false);
    const { colors } = useAppTheme();

    if (!subPicker) return null;

    const currentPosition = subPicker.position;
    const isFrontRow = [2, 3, 4].includes(currentPosition);
    const currentPlayerId = currentRotation?.find(p => p.position === currentPosition)?.playerId;
    const knownLiberos = liberoIds || [];

    // Partner Logic
    const partnerId = currentPlayerId && subPairs ? subPairs[currentPlayerId] : null;

    // Partition Roster
    const eligible: Player[] = [];
    const ineligible: { player: Player; reason: string }[] = [];

    roster.forEach(player => {
        // 1. Exclude players already on court (Always hidden/excluded from selection)
        if (currentRotation?.some(p => p.playerId === player.id)) return;

        let isBlocked = false;
        let reason = "";

        // 2. Libero Constraints
        const isPlayerLibero = knownLiberos.includes(player.id);
        if (isFrontRow && isPlayerLibero) {
            isBlocked = true;
            reason = "Libero (Front Row Constraint)";
        }

        // 3. Pairing Isolation
        if (!isBlocked) {
            if (partnerId) {
                // If I have a partner, ANYONE ELSE is a mismatch
                if (player.id !== partnerId) {
                    isBlocked = true;
                    reason = "Partner Mismatch";
                }
            } else {
                // If I have no partner, players who ARE paired are blocked
                // UNLESS the 'paired' player is a Libero (Liberos are universal subs for back row)
                const playerHasPartner = subPairs && (subPairs[player.id]);
                const isTargetLibero = knownLiberos.includes(player.id);

                if (playerHasPartner && !isTargetLibero) {
                    isBlocked = true;
                    reason = "Player is Paired";
                }
            }
        }

        if (isBlocked) {
            ineligible.push({ player, reason });
        } else {
            eligible.push(player);
        }
    });

    // Sort both lists by jersey number for consistency with other player displays
    eligible.sort((a, b) => parseInt(a.jerseyNumber, 10) - parseInt(b.jerseyNumber, 10));
    ineligible.sort((a, b) => parseInt(a.player.jerseyNumber, 10) - parseInt(b.player.jerseyNumber, 10));

    const renderRosterItem = (item: Player, isDisabled: boolean = false, reason?: string) => {
        const isLibero = knownLiberos.includes(item.id);
        const isPartner = item.id === partnerId;

        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.rosterItem,
                    { borderBottomColor: colors.border },
                    isPartner && { backgroundColor: colors.primaryLight },
                    isDisabled && { backgroundColor: colors.bg }
                ]}
                onPress={() => {
                    const isBackRow = [1, 5, 6].includes(currentPosition);
                    const hasNonLiberoDesignation = nonLiberoDesignations.includes(item.id);

                    if (isBackRow && !isLibero && !hasNonLiberoDesignation) {
                        Alert.alert(
                            "Libero Replacement?",
                            `Is ${item.name} entering as Libero?`,
                            [
                                {
                                    text: "No",
                                    onPress: () => {
                                        onDesignateNonLibero(item.id);
                                        onSub(item, false);
                                    }
                                },
                                {
                                    text: "Yes",
                                    onPress: () => {
                                        // Validate Libero Rules

                                        // Rule 1: Max 1 Libero on Court (unless swapping Libero for Libero, which is rare but allowed if 2 liberos)
                                        // Check if anyone else in currentRotation is a Libero
                                        const otherLiberoOnCourt = currentRotation?.find(p => p.playerId && knownLiberos.includes(p.playerId) && p.position !== currentPosition);

                                        if (otherLiberoOnCourt) {
                                            const otherP = roster.find(r => r.id === otherLiberoOnCourt.playerId);
                                            Alert.alert("Invalid Substitution", `Only one Libero allows on court. #${otherP?.jerseyNumber} is already in the game.`);
                                            return;
                                        }

                                        // Rule 2: Max 2 Designated Liberos per Team
                                        // If this player is not already a known Libero, and we have 2, block.
                                        if (!knownLiberos.includes(item.id) && knownLiberos.length >= 2) {
                                            Alert.alert("Invalid Substitution", "Maximum of 2 Liberos designated per set found.");
                                            return;
                                        }

                                        onSub(item, true)
                                    }
                                }
                            ]
                        );
                    } else {
                        // Regular Sub
                        onSub(item, isLibero);
                    }
                }}
            >
                <View style={[styles.jerseyCircle, { backgroundColor: colors.border }, isLibero && { backgroundColor: colors.text }, isDisabled && { opacity: 0.5 }]}>
                    <Text style={[styles.jerseyText, { color: colors.text }, isLibero && { color: '#ffffff' }]}>
                        {item.jerseyNumber}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rosterName, { color: colors.text }, isDisabled && { color: colors.textTertiary }]}>
                        {item.name} {isLibero && <Text style={{ fontWeight: 'bold', color: colors.textSecondary }}> (L)</Text>}
                    </Text>
                    {isPartner && <Text style={[styles.suggestedLabel, { color: colors.primary }]}>Paired Partner</Text>}
                    {reason && <Text style={[styles.reasonLabel, { color: colors.textTertiary }]}>{reason}</Text>}
                </View>
                {isPartner && <Lock size={16} color={colors.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.modalContainer, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
                <View>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Substitute P{currentPosition}</Text>
                    {isFrontRow && <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Front Row (No Liberos)</Text>}
                </View>
                <TouchableOpacity onPress={onClose}>
                    <X size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={eligible}
                keyExtractor={item => item.id}
                // Render ineligible list in footer (collapsible)
                ListFooterComponent={
                    <View>
                        {ineligible.length > 0 && (
                            <View style={[styles.ineligibleSection, { borderTopColor: colors.border }]}>
                                <TouchableOpacity
                                    style={styles.collapseHeader}
                                    onPress={() => setShowIneligible(!showIneligible)}
                                >
                                    <Text style={[styles.collapseText, { color: colors.textSecondary }]}>
                                        {showIneligible ? "Hide" : "Show"} Ineligible Players ({ineligible.length})
                                    </Text>
                                    {showIneligible ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                                </TouchableOpacity>

                                {showIneligible && (
                                    <View>
                                        {ineligible.map(({ player, reason }) => renderRosterItem(player, true, reason))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    eligible.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No eligible players.</Text>
                            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Check ineligible list below.</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => renderRosterItem(item)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        padding: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalSubtitle: {
        fontSize: 12,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: 8,
        borderRadius: 8,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    rosterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    rosterItemHighlight: {
    },
    rosterItemDisabled: {
    },
    rosterItemLibero: {
    },
    jerseyCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    jerseyText: {
        fontSize: 16,
        fontWeight: '700',
    },
    rosterName: {
        fontSize: 16,
    },
    suggestedLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    reasonLabel: {
        fontSize: 10,
        fontStyle: 'italic',
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptySub: {
        fontSize: 14,
        marginTop: 4,
    },
    ineligibleSection: {
        marginTop: 20,
        borderTopWidth: 1,
        paddingTop: 10,
    },
    collapseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    collapseText: {
        fontSize: 14,
        fontWeight: '600',
    }
});
