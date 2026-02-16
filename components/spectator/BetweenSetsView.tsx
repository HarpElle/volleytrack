import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, Sparkles } from 'lucide-react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { Score, SetResult, MatchConfig } from '../../types';

interface BetweenSetsViewProps {
    currentSet: number;
    setsWon: Score;
    setHistory: SetResult[];
    config: MatchConfig;
    myTeamName: string;
    opponentName: string;
    onViewSetStats?: () => void;
    onGenerateRecap?: () => void;
}

/**
 * Transitional view displayed between sets.
 * Shows the completed set score, overall sets won, and action buttons.
 * Features a pulsing "waiting" animation.
 */
export function BetweenSetsView({
    currentSet,
    setsWon,
    setHistory,
    config,
    myTeamName,
    opponentName,
    onViewSetStats,
    onGenerateRecap,
}: BetweenSetsViewProps) {
    const { colors } = useAppTheme();
    const pulseAnim = useRef(new Animated.Value(0)).current;

    // Get the last completed set info
    const completedSet = currentSet - 1;
    const lastSetResult = setHistory.find(s => s.setNumber === completedSet);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const dotOpacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 1],
    });

    const myTeamWonLast = lastSetResult?.winner === 'myTeam';

    return (
        <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.setLabel, { color: colors.primary }]}>
                🏐 SET {completedSet} COMPLETE
            </Text>

            {lastSetResult && (
                <View style={styles.scoreRow}>
                    <Text style={[
                        styles.teamName,
                        { color: myTeamWonLast ? colors.primary : colors.textSecondary },
                        myTeamWonLast && styles.winner,
                    ]}>
                        {myTeamName}
                    </Text>
                    <Text style={[styles.scoreText, { color: colors.text }]}>
                        {lastSetResult.score.myTeam}  -  {lastSetResult.score.opponent}
                    </Text>
                    <Text style={[
                        styles.teamName,
                        { color: !myTeamWonLast ? colors.opponent : colors.textSecondary },
                        !myTeamWonLast && styles.winner,
                    ]}>
                        {opponentName}
                    </Text>
                </View>
            )}

            <View style={[styles.setsRow, { borderColor: colors.border }]}>
                <Text style={[styles.setsLabel, { color: colors.textSecondary }]}>Sets</Text>
                <Text style={[styles.setsScore, { color: colors.text }]}>
                    {myTeamName} {setsWon.myTeam} - {setsWon.opponent} {opponentName}
                </Text>
            </View>

            {/* Set history */}
            {setHistory.length > 0 && (
                <View style={styles.historyRow}>
                    {setHistory.map((s) => (
                        <View
                            key={s.setNumber}
                            style={[
                                styles.setChip,
                                {
                                    backgroundColor: s.winner === 'myTeam'
                                        ? `${colors.primary}20`
                                        : `${colors.opponent}20`,
                                    borderColor: s.winner === 'myTeam'
                                        ? `${colors.primary}40`
                                        : `${colors.opponent}40`,
                                },
                            ]}
                        >
                            <Text style={[
                                styles.setChipText,
                                { color: s.winner === 'myTeam' ? colors.primary : colors.opponent },
                            ]}>
                                S{s.setNumber}: {s.score.myTeam}-{s.score.opponent}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Action buttons */}
            <View style={styles.actions}>
                {onViewSetStats && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.buttonSecondary }]}
                        onPress={onViewSetStats}
                    >
                        <BarChart3 size={16} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>View Set Stats</Text>
                    </TouchableOpacity>
                )}
                {onGenerateRecap && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: `${colors.primary}15` }]}
                        onPress={onGenerateRecap}
                    >
                        <Sparkles size={16} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>Fan Recap</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Waiting indicator */}
            <View style={styles.waitingRow}>
                <Text style={[styles.waitingText, { color: colors.textTertiary }]}>
                    Next set starting soon
                </Text>
                <View style={styles.dotsRow}>
                    {[0, 1, 2].map(i => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: pulseAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [
                                            i === 0 ? 0.3 : i === 1 ? 0.5 : 0.7,
                                            i === 0 ? 1 : i === 1 ? 0.7 : 0.3,
                                        ],
                                    }),
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 20,
        marginVertical: 12,
        borderWidth: 1,
        alignItems: 'center',
        gap: 14,
    },
    setLabel: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    teamName: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    winner: {
        fontWeight: '800',
    },
    scoreText: {
        fontSize: 28,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    setsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        width: '100%',
        justifyContent: 'center',
    },
    setsLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    setsScore: {
        fontSize: 14,
        fontWeight: '700',
    },
    historyRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    setChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    setChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '700',
    },
    waitingRow: {
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    waitingText: {
        fontSize: 13,
        fontWeight: '600',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
