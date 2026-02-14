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
    const { colors } = useAppTheme();
    const myScore = score.myTeam;
    const oppScore = score.opponent;
    const iWon = myScore > oppScore;

    // Calculate if match is won based on this set result
    // If I won this set, add 1 to my setsWon
    const myTotalWins = setsWon.myTeam + (iWon ? 1 : 0);
    const oppTotalWins = setsWon.opponent + (!iWon ? 1 : 0);
    const setsToWin = Math.ceil(totalSets / 2);
    const isMatchFinished = myTotalWins >= setsToWin || oppTotalWins >= setsToWin;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <View style={[styles.card, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Set {setNumber} Finished</Text>

                    <View style={styles.resultContainer}>
                        <View style={styles.teamRow}>
                            <Text style={[styles.teamName, iWon && styles.winner, { color: iWon ? colors.primary : colors.textSecondary }]}>{myTeamName}</Text>
                            <Text style={[styles.score, iWon && styles.winnerScore, { color: iWon ? colors.primary : colors.textSecondary }]}>{myScore}</Text>
                        </View>
                        <View style={styles.teamRow}>
                            <Text style={[styles.teamName, !iWon && styles.winner, { color: !iWon ? colors.primary : colors.textSecondary }]}>{opponentName}</Text>
                            <Text style={[styles.score, !iWon && styles.winnerScore, { color: !iWon ? colors.primary : colors.textSecondary }]}>{oppScore}</Text>
                        </View>
                    </View>

                    <Text style={[styles.winnerLabel, { color: colors.text }]}>
                        Winner: {iWon ? myTeamName : opponentName}
                    </Text>

                    <View style={styles.actions}>
                        {/* Primary Flow Actions */}
                        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.text }]} onPress={() => { onNextSet(); haptics('success'); }}>
                            <Text style={[styles.primaryBtnText, { color: colors.bg }]}>
                                {isMatchFinished ? 'Finish Match' : 'Start Next Set'}
                            </Text>
                        </TouchableOpacity>

                        {/* Secondary Corrections */}
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.buttonSecondary }]} onPress={() => { onCorrectScore(); haptics('medium'); }}>
                                <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Wait, Correct Score</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.buttonSecondary }]} onPress={onNextSet}>
                                <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Continue Set</Text>
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
        backgroundColor: 'rgba(0,0,0,0.6)', // Semi-transparent black
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#333',
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
        color: '#666',
    },
    score: {
        fontSize: 28,
        fontWeight: '800',
        color: '#666',
        fontVariant: ['tabular-nums'],
    },
    winner: {
        color: '#0066cc',
        fontWeight: '800',
    },
    winnerScore: {
        color: '#0066cc',
    },
    winnerLabel: {
        fontSize: 16,
        color: '#333',
        fontWeight: '600',
        marginBottom: 32,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    primaryBtn: {
        backgroundColor: '#333',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#fff',
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
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    smallBtnText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
});
