import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useHaptics } from '../hooks/useHaptic';
import { useAppTheme } from '../contexts/ThemeContext';
import { Score } from '../types';

interface EndOfSetModalProps {
    visible: boolean;
    setNumber: number;
    score: Score;
    myTeamName: string;
    opponentName: string;
    setsWon: Score;
    totalSets: number;
    onNextSet: () => void;
    onCorrectScore: () => void;
}

export default function EndOfSetModal({
    visible,
    setNumber,
    score,
    myTeamName,
    opponentName,
    setsWon,
    totalSets,
    onNextSet,
    onCorrectScore,
}: EndOfSetModalProps) {
    const haptics = useHaptics();
    const { colors, radius } = useAppTheme();
    const myScore = score.myTeam;
    const oppScore = score.opponent;
    const iWon = myScore > oppScore;

    // Calculate if match is won based on this set result
    // If I won this set, add 1 to my setsWon
    const myTotalWins = setsWon.myTeam + (iWon ? 1 : 0);
    const oppTotalWins = setsWon.opponent + (!iWon ? 1 : 0);
    const setsToWin = Math.ceil(totalSets / 2);
    const isMatchFinished = myTotalWins >= setsToWin || oppTotalWins >= setsToWin;

    const primaryLabel = isMatchFinished ? 'Finish Match' : 'Start Next Set';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, borderRadius: radius.xl }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Set {setNumber} Finished</Text>

                    <View style={styles.resultContainer}>
                        <View style={styles.teamRow}>
                            <Text style={[styles.teamName, iWon && styles.winner, { color: iWon ? colors.primary : colors.textSecondary }]}>{myTeamName}</Text>
                            <Text style={[styles.score, iWon && styles.winnerScore, { color: iWon ? colors.primary : colors.textSecondary }]}>{myScore}</Text>
                        </View>
                        <View style={styles.teamRow}>
                            <Text style={[styles.teamName, !iWon && styles.winner, { color: !iWon ? colors.opponent : colors.textSecondary }]}>{opponentName}</Text>
                            <Text style={[styles.score, !iWon && styles.winnerScore, { color: !iWon ? colors.opponent : colors.textSecondary }]}>{oppScore}</Text>
                        </View>
                    </View>

                    <Text style={[styles.winnerLabel, { color: colors.text }]}>
                        Winner: {iWon ? myTeamName : opponentName}
                    </Text>

                    <View style={styles.actions}>
                        {/* Primary Flow Actions */}
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                            onPress={() => { onNextSet(); haptics('success'); }}
                            accessibilityLabel={primaryLabel}
                        >
                            <Text style={[styles.primaryBtnText, { color: colors.buttonPrimaryText }]}>
                                {primaryLabel}
                            </Text>
                        </TouchableOpacity>

                        {/* Secondary Corrections */}
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: colors.buttonSecondary, borderRadius: radius.sm }]}
                                onPress={() => { onCorrectScore(); haptics('medium'); }}
                                accessibilityLabel="Correct Score"
                            >
                                <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Correct Score</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: colors.buttonSecondary, borderRadius: radius.sm }]}
                                onPress={onNextSet}
                                accessibilityLabel="Keep Playing"
                            >
                                <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Keep Playing</Text>
                            </TouchableOpacity>
                        </View>
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
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 24,
    },
    resultContainer: {
        width: '100%',
        marginBottom: 24,
        gap: 12,
    },
    teamRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    teamName: {
        fontSize: 20,
        fontWeight: '600',
    },
    score: {
        fontSize: 28,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    winner: {
        fontWeight: '800',
    },
    winnerScore: {},
    winnerLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 32,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    primaryBtn: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryBtnText: {
        fontSize: 18,
        fontWeight: '700',
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 12,
    },
    smallBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    smallBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
