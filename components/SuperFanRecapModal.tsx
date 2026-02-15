/**
 * SuperFanRecapModal — Modal for spectators to:
 * 1. Select player(s) from the roster
 * 2. Generate an AI-powered celebratory recap focused on those players
 * 3. Share the recap via clipboard or native share
 *
 * Free tier: 2 free recaps, then requires Pro subscription.
 */

import { Crown, Share2, Sparkles, Star, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { GeminiService } from '../services/ai/GeminiService';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { LiveMatchSnapshot, Player, Score, SuperFanRecap } from '../types';
import { FREE_FAN_RECAP_LIMIT } from '../constants/monetization';

interface SuperFanRecapModalProps {
    visible: boolean;
    onClose: () => void;
    match: LiveMatchSnapshot | null;
    onShowPaywall: () => void;
}

export function SuperFanRecapModal({ visible, onClose, match, onShowPaywall }: SuperFanRecapModalProps) {
    const { colors, radius } = useAppTheme();
    const {
        isPro,
        canUseFanRecap,
        incrementFanRecaps,
        getRemainingFanRecaps,
    } = useSubscriptionStore();

    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [recap, setRecap] = useState<SuperFanRecap | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const state = match?.currentState;
    const roster = state?.myTeamRoster || [];
    const remaining = getRemainingFanRecaps();

    const togglePlayer = (playerId: string) => {
        setSelectedPlayerIds(prev =>
            prev.includes(playerId)
                ? prev.filter(id => id !== playerId)
                : prev.length < 3
                    ? [...prev, playerId]
                    : prev // Max 3 players
        );
        // Clear previous recap when selection changes
        if (recap) setRecap(null);
        if (error) setError(null);
    };

    const handleGenerate = async () => {
        if (selectedPlayerIds.length === 0) {
            Alert.alert('Select a Player', 'Pick at least one player to create your fan recap.');
            return;
        }

        if (!canUseFanRecap()) {
            onShowPaywall();
            return;
        }

        if (!state) return;

        setIsGenerating(true);
        setError(null);

        try {
            const gemini = new GeminiService();
            const result = await gemini.generateSuperFanRecap(
                state.myTeamName,
                state.opponentName,
                state.scores,
                state.setsWon,
                state.history,
                roster,
                selectedPlayerIds,
                state.status
            );

            setRecap(result);
            incrementFanRecaps();
        } catch (err: any) {
            setError(err.message || 'Failed to generate recap. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShare = async () => {
        if (!recap) return;
        try {
            await Share.share({
                message: recap.recap,
            });
        } catch (_) {
            // User cancelled or share failed
        }
    };

    const handleClose = () => {
        setSelectedPlayerIds([]);
        setRecap(null);
        setError(null);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                    <View style={{ width: 32 }} />
                    <View style={styles.headerCenter}>
                        <Star size={18} color={colors.primary} fill={colors.primary} />
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Super Fan Recap</Text>
                    </View>
                    <TouchableOpacity onPress={handleClose} hitSlop={8}>
                        <X size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Recap result view */}
                    {recap ? (
                        <View>
                            <View style={[styles.recapCard, { backgroundColor: colors.bgCard, borderRadius: radius.md }]}>
                                <View style={styles.recapHeader}>
                                    <Sparkles size={18} color={colors.primary} />
                                    <Text style={[styles.recapTitle, { color: colors.primary }]}>
                                        {`${recap.playerNames.join(' & ')}'s Recap`}
                                    </Text>
                                </View>
                                <Text style={[styles.recapText, { color: colors.text }]}>
                                    {recap.recap}
                                </Text>
                            </View>

                            {/* Share button */}
                            <TouchableOpacity
                                style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                                onPress={handleShare}
                            >
                                <Share2 size={18} color="#ffffff" />
                                <Text style={styles.shareBtnText}>Share Recap</Text>
                            </TouchableOpacity>

                            {/* Generate another */}
                            <TouchableOpacity
                                style={[styles.anotherBtn, { borderColor: colors.border }]}
                                onPress={() => {
                                    setRecap(null);
                                    setSelectedPlayerIds([]);
                                }}
                            >
                                <Text style={[styles.anotherBtnText, { color: colors.textSecondary }]}>
                                    Create Another Recap
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View>
                            {/* Instructions */}
                            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
                                Select up to 3 players to get a personalized AI recap celebrating their performance. Perfect for sharing with family!
                            </Text>

                            {/* Free tier indicator */}
                            {!isPro && (
                                <View style={[styles.freeIndicator, { backgroundColor: colors.primaryLight }]}>
                                    <Text style={[styles.freeText, { color: colors.primary }]}>
                                        {remaining > 0
                                            ? `${remaining} of ${FREE_FAN_RECAP_LIMIT} free recaps remaining`
                                            : 'No free recaps remaining'}
                                    </Text>
                                    {remaining === 0 && (
                                        <TouchableOpacity onPress={onShowPaywall}>
                                            <View style={styles.upgradeRow}>
                                                <Crown size={14} color={colors.primary} />
                                                <Text style={[styles.upgradeText, { color: colors.primary }]}>Upgrade to Pro</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Player selection */}
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                SELECT PLAYER{selectedPlayerIds.length > 0 ? `S (${selectedPlayerIds.length}/3)` : 'S'}
                            </Text>

                            <View style={styles.playerGrid}>
                                {roster.map(player => {
                                    const isSelected = selectedPlayerIds.includes(player.id);
                                    return (
                                        <TouchableOpacity
                                            key={player.id}
                                            style={[
                                                styles.playerCard,
                                                {
                                                    backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                                                    borderColor: isSelected ? colors.primary : colors.border,
                                                    borderRadius: radius.sm,
                                                },
                                            ]}
                                            onPress={() => togglePlayer(player.id)}
                                        >
                                            <Text style={[
                                                styles.playerNumber,
                                                { color: isSelected ? colors.primary : colors.textSecondary }
                                            ]}>
                                                #{player.jerseyNumber}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.playerName,
                                                    { color: isSelected ? colors.primary : colors.text }
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {player.name}
                                            </Text>
                                            {isSelected && (
                                                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                                    <Star size={10} color="#ffffff" fill="#ffffff" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Error */}
                            {error && (
                                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                            )}

                            {/* Generate button */}
                            <TouchableOpacity
                                style={[
                                    styles.generateBtn,
                                    {
                                        backgroundColor: selectedPlayerIds.length > 0 ? colors.primary : colors.buttonDisabled,
                                        opacity: isGenerating ? 0.6 : 1,
                                    },
                                ]}
                                onPress={handleGenerate}
                                disabled={isGenerating || selectedPlayerIds.length === 0}
                            >
                                {isGenerating ? (
                                    <View style={styles.generatingRow}>
                                        <ActivityIndicator color="#ffffff" size="small" />
                                        <Text style={styles.generateBtnText}>Creating your recap...</Text>
                                    </View>
                                ) : (
                                    <View style={styles.generatingRow}>
                                        <Sparkles size={18} color={selectedPlayerIds.length > 0 ? '#ffffff' : colors.buttonDisabledText} />
                                        <Text style={[
                                            styles.generateBtnText,
                                            { color: selectedPlayerIds.length > 0 ? '#ffffff' : colors.buttonDisabledText }
                                        ]}>
                                            Generate Fan Recap
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    instructions: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
        textAlign: 'center',
    },
    freeIndicator: {
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    freeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    upgradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    upgradeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    playerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    playerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 8,
        minWidth: '45%',
        flexGrow: 1,
        position: 'relative',
    },
    playerNumber: {
        fontSize: 14,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    playerName: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    checkBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    generateBtn: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    generatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    generateBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Recap result styles
    recapCard: {
        padding: 20,
        marginBottom: 16,
    },
    recapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    recapTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    recapText: {
        fontSize: 15,
        lineHeight: 24,
    },
    shareBtn: {
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    shareBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    anotherBtn: {
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    anotherBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
