import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Team } from '../types';

interface ServeChoiceModalProps {
    visible: boolean;
    myTeamName: string;
    opponentName: string;
    currentSet: number;
    totalSets: number;
    suggestedServer: Team | null; // Pre-highlighted team, null = no suggestion (Set 1 or deciding set)
    onChoose: (team: Team) => void;
}

export default function ServeChoiceModal({
    visible,
    myTeamName,
    opponentName,
    currentSet,
    totalSets,
    suggestedServer,
    onChoose,
}: ServeChoiceModalProps) {
    const { colors } = useAppTheme();

    const isDecidingSet = currentSet === totalSets;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        Who Serves First?
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Set {currentSet}{isDecidingSet && currentSet > 1 ? ' — Deciding Set' : ''}
                    </Text>

                    <View style={styles.choices}>
                        {/* My Team Card */}
                        <TouchableOpacity
                            style={[
                                styles.teamCard,
                                { backgroundColor: colors.bg, borderColor: colors.border },
                                suggestedServer === 'myTeam' && {
                                    borderColor: colors.primary,
                                    backgroundColor: colors.primaryLight,
                                }
                            ]}
                            onPress={() => onChoose('myTeam')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.ball, { backgroundColor: colors.primary }]}>
                                <Text style={styles.ballEmoji}>🏐</Text>
                            </View>
                            <Text
                                style={[
                                    styles.teamName,
                                    { color: colors.text },
                                    suggestedServer === 'myTeam' && { color: colors.primary, fontWeight: '800' }
                                ]}
                                numberOfLines={2}
                            >
                                {myTeamName}
                            </Text>
                            {suggestedServer === 'myTeam' && (
                                <Text style={[styles.badge, { color: colors.primary }]}>Expected</Text>
                            )}
                        </TouchableOpacity>

                        {/* Opponent Card */}
                        <TouchableOpacity
                            style={[
                                styles.teamCard,
                                { backgroundColor: colors.bg, borderColor: colors.border },
                                suggestedServer === 'opponent' && {
                                    borderColor: colors.opponent,
                                    backgroundColor: colors.opponentLight,
                                }
                            ]}
                            onPress={() => onChoose('opponent')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.ball, { backgroundColor: colors.opponent }]}>
                                <Text style={styles.ballEmoji}>🏐</Text>
                            </View>
                            <Text
                                style={[
                                    styles.teamName,
                                    { color: colors.text },
                                    suggestedServer === 'opponent' && { color: colors.opponent, fontWeight: '800' }
                                ]}
                                numberOfLines={2}
                            >
                                {opponentName}
                            </Text>
                            {suggestedServer === 'opponent' && (
                                <Text style={[styles.badge, { color: colors.opponent }]}>Expected</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Hint text */}
                    {suggestedServer && !isDecidingSet && (
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            Based on alternating serve
                        </Text>
                    )}
                    {isDecidingSet && currentSet > 1 && (
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            Deciding set — new coin toss
                        </Text>
                    )}
                    {currentSet === 1 && (
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            Select the team that won the coin toss
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
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
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 24,
    },
    choices: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
        marginBottom: 20,
    },
    teamCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 2,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
        gap: 10,
    },
    ball: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ballEmoji: {
        fontSize: 24,
    },
    teamName: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    badge: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
});
