import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Save, Share2, Sparkles } from 'lucide-react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { Score, SetResult, MatchConfig } from '../../types';

interface MatchCompleteViewProps {
    myTeamName: string;
    opponentName: string;
    setsWon: Score;
    setHistory: SetResult[];
    config: MatchConfig;
    cheerCount: number;
    peakViewers: number;
    matchCode: string;
    isSaved: boolean;
    onSaveMatch: () => void;
    onGenerateRecap?: () => void;
}

/**
 * Celebration/summary screen shown when the match ends.
 * Win = celebration with confetti feeling; loss = warm, encouraging tone.
 */
export function MatchCompleteView({
    myTeamName,
    opponentName,
    setsWon,
    setHistory,
    config,
    cheerCount,
    peakViewers,
    matchCode,
    isSaved,
    onSaveMatch,
    onGenerateRecap,
}: MatchCompleteViewProps) {
    const { colors } = useAppTheme();
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const myTeamWon = setsWon.myTeam > setsWon.opponent;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const setScoresText = setHistory
        .map(s => `${s.score.myTeam}-${s.score.opponent}`)
        .join(' · ');

    const handleShare = async () => {
        const resultText = myTeamWon
            ? `${myTeamName} wins!`
            : `Great effort, ${myTeamName}!`;

        const message = [
            `🏐 ${resultText}`,
            `${setsWon.myTeam} - ${setsWon.opponent}`,
            setScoresText,
            '',
            `Followed live on VolleyTrack`,
            `Code: ${matchCode}`,
        ].join('\n');

        try {
            await Share.share({ message });
        } catch {
            // User cancelled
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.bgCard,
                    borderColor: myTeamWon ? `${colors.primary}40` : colors.border,
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            {/* Celebration or encouragement header */}
            <Text style={styles.headerEmoji}>
                {myTeamWon ? '🎉🏐🎉' : '💪🏐'}
            </Text>

            <Text style={[
                styles.resultText,
                { color: myTeamWon ? colors.primary : colors.text },
            ]}>
                {myTeamWon ? `${myTeamName.toUpperCase()} WIN!` : `Great effort, ${myTeamName}!`}
            </Text>

            {/* Sets score */}
            <Text style={[styles.setsScore, { color: colors.text }]}>
                {setsWon.myTeam} - {setsWon.opponent}
            </Text>

            {/* Individual set scores */}
            <Text style={[styles.setDetails, { color: colors.textSecondary }]}>
                {setScoresText}
            </Text>

            {/* Action buttons */}
            <View style={styles.actions}>
                {onGenerateRecap && (
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                        onPress={onGenerateRecap}
                    >
                        <Sparkles size={16} color={colors.buttonPrimaryText} />
                        <Text style={[styles.primaryBtnText, { color: colors.buttonPrimaryText }]}>
                            Generate Fan Recap
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.secondaryRow}>
                    <TouchableOpacity
                        style={[styles.secondaryBtn, { backgroundColor: colors.buttonSecondary }]}
                        onPress={handleShare}
                    >
                        <Share2 size={16} color={colors.primary} />
                        <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.secondaryBtn,
                            { backgroundColor: isSaved ? `${colors.success}15` : colors.buttonSecondary },
                        ]}
                        onPress={onSaveMatch}
                        disabled={isSaved}
                    >
                        <Save size={16} color={isSaved ? colors.success : colors.primary} />
                        <Text style={[
                            styles.secondaryBtnText,
                            { color: isSaved ? colors.success : colors.primary },
                        ]}>
                            {isSaved ? 'Saved' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Community stats */}
            <View style={[styles.communityRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.communityText, { color: colors.textTertiary }]}>
                    Thank you for cheering with us!
                </Text>
                <View style={styles.statsRow}>
                    {cheerCount > 0 && (
                        <Text style={[styles.statItem, { color: colors.textSecondary }]}>
                            👏 {cheerCount} cheers
                        </Text>
                    )}
                    {peakViewers > 0 && (
                        <Text style={[styles.statItem, { color: colors.textSecondary }]}>
                            👥 {peakViewers} peak viewers
                        </Text>
                    )}
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 24,
        marginVertical: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        gap: 8,
    },
    headerEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    resultText: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    setsScore: {
        fontSize: 36,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    setDetails: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    actions: {
        width: '100%',
        gap: 10,
        marginTop: 8,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryRow: {
        flexDirection: 'row',
        gap: 10,
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
    },
    secondaryBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    communityRow: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 14,
        marginTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 6,
    },
    communityText: {
        fontSize: 13,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        fontSize: 13,
        fontWeight: '600',
    },
});
