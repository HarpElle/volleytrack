import { Volleyball } from 'lucide-react-native';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useAppTheme } from '../contexts/ThemeContext';
import { MatchConfig, Score, SetConfig, SetResult } from '../types';

interface ScoreBoardProps {
    myTeamName: string;
    opponentName: string;
    currentSet: number;
    score: Score;
    setsWon: Score;
    setConfig: SetConfig;
    config: MatchConfig;
    setHistory: SetResult[];
    onScoreLongPress: (team: 'myTeam' | 'opponent') => void;
    servingTeam: 'myTeam' | 'opponent';
    onToggleServe: () => void;
    // Timeouts
    timeoutsRemaining: { myTeam: number; opponent: number };
    onUseTimeout: (team: 'myTeam' | 'opponent') => void;
    configTimeouts: number;
    onIncrement: (team: 'myTeam' | 'opponent') => void;
    onDecrement: (team: 'myTeam' | 'opponent') => void;
    // Spectator mode
    readOnly?: boolean;
}

export default function ScoreBoard({
    myTeamName,
    opponentName,
    currentSet,
    score,
    setsWon,
    setConfig,
    config,
    setHistory,
    onScoreLongPress,
    servingTeam,
    onToggleServe,
    timeoutsRemaining,
    onUseTimeout,
    configTimeouts,
    onIncrement,
    onDecrement,
    readOnly = false
}: ScoreBoardProps) {
    const { colors, isDark, shadows } = useAppTheme();
    // Determine game state status
    let statusText = '';
    const myScore = score.myTeam;
    const oppScore = score.opponent;
    const diff = Math.abs(myScore - oppScore);
    const { targetScore, winBy, cap } = setConfig;

    // Check for Set Point / Match Point logic
    const isSetPoint = (teamScore: number, otherScore: number) => {
        // Must be at least target-1 and leading
        if (teamScore >= targetScore - 1 && teamScore > otherScore) {
            // If teamScore + 1 would win, it's set point.
            // Win condition: >= target AND >= other + winBy OR hit cap.
            const potentialScore = teamScore + 1;
            const wouldWin = (potentialScore >= targetScore && potentialScore >= otherScore + winBy) ||
                (potentialScore === cap && potentialScore > otherScore);
            return wouldWin;
        }
        return false;
    };

    const mySetPoint = isSetPoint(myScore, oppScore);
    const oppSetPoint = isSetPoint(oppScore, myScore);

    // Match Point Logic
    // Sets needed to win match (Math.ceil(totalSets / 2))
    const setsToWin = Math.ceil(config.totalSets / 2);
    // If I am at Set Point AND (My Sets Won + 1 == Sets To Win), it's Match Point.
    const myMatchPoint = mySetPoint && (setsWon.myTeam + 1 === setsToWin);
    const oppMatchPoint = oppSetPoint && (setsWon.opponent + 1 === setsToWin);

    // Safeguard: Ensure setHistory is an array (persistence migration issue)
    const safeHistory = Array.isArray(setHistory) ? setHistory : [];

    // Deuce / Win-by logic display
    // Show "Must win by X" if we are past target-1 and tied or close
    if (myScore >= targetScore - 1 && oppScore >= targetScore - 1 && diff < winBy) {
        statusText = `Must win by ${winBy}`;
    }

    if (myMatchPoint || oppMatchPoint) {
        statusText = 'MATCH POINT';
    } else if (mySetPoint || oppSetPoint) {
        statusText = 'SET POINT';
    }

    // Gesture Logic — disabled in readOnly (spectator) mode
    const ScoreGesture = ({ team, children }: { team: 'myTeam' | 'opponent', children: React.ReactNode }) => {
        if (readOnly) return <View>{children}</View>;
        const increment = () => {
            onIncrement(team);
        };

        const decrement = () => {
            onDecrement(team);
        };

        const tap = Gesture.Tap().onEnd(() => {
            runOnJS(increment)();
        });

        // Swipe R->L (Left) or T->B (Down) to Increment
        const swipeInc1 = Gesture.Fling().direction(Directions.LEFT).onEnd(() => runOnJS(increment)());
        const swipeInc2 = Gesture.Fling().direction(Directions.DOWN).onEnd(() => runOnJS(increment)());

        // Swipe L->R (Right) or B->T (Up) to Decrement
        const swipeDec1 = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => runOnJS(decrement)());
        const swipeDec2 = Gesture.Fling().direction(Directions.UP).onEnd(() => runOnJS(decrement)());

        const composed = Gesture.Race(tap, swipeInc1, swipeInc2, swipeDec1, swipeDec2);

        return (
            <GestureDetector gesture={composed}>
                <View>{children}</View>
            </GestureDetector>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bgCard }, shadows.md(isDark)]}>
            {/* Set Pills Header */}
            <View style={styles.header}>
                <View style={styles.pillsContainer}>
                    {[...Array(config.totalSets)].map((_, index) => {
                        const setNum = index + 1;
                        const isActive = setNum === currentSet;
                        // Check if this set is completed and in history
                        const historyItem = safeHistory.find(h => h.setNumber === setNum);
                        const isCompleted = !!historyItem;

                        // Determine style based on winner
                        let pillStyle: StyleProp<ViewStyle> = styles.pill;
                        let textStyle: StyleProp<TextStyle> = styles.pillText;

                        if (isActive) {
                            pillStyle = [styles.pill, styles.pillActive, { backgroundColor: colors.text }];
                            textStyle = [styles.pillText, styles.pillTextActive, { color: colors.bg }];
                        } else if (isCompleted && historyItem) {
                            if (historyItem.winner === 'myTeam') {
                                pillStyle = [styles.pill, styles.pillWonMy, { backgroundColor: colors.primary }];
                                textStyle = [styles.pillText, styles.pillTextActive, { color: colors.textInverse }];
                            } else {
                                pillStyle = [styles.pill, styles.pillWonOpp, { backgroundColor: colors.opponent }];
                                textStyle = [styles.pillText, styles.pillTextActive, { color: colors.textInverse }];
                            }
                        } else if (setNum > currentSet) {
                            pillStyle = [styles.pill, styles.pillFuture, { backgroundColor: colors.bg, borderColor: colors.border }];
                            textStyle = [styles.pillText, styles.pillTextFuture, { color: colors.textTertiary }];
                        } else {
                            pillStyle = [styles.pill, { backgroundColor: colors.border }];
                            textStyle = [styles.pillText, { color: colors.textSecondary }];
                        }

                        return (
                            <View
                                key={setNum}
                                style={pillStyle}
                            >
                                <Text style={textStyle}>
                                    {isCompleted && historyItem ?
                                        `${historyItem.score.myTeam}-${historyItem.score.opponent}`
                                        : setNum}
                                </Text>
                            </View>
                        );
                    })}
                </View>
                <View style={styles.statusContainer}>
                    {statusText ? <Text style={[styles.statusText, { color: colors.warning }]}>{statusText}</Text> : null}
                </View>
            </View>

            <View style={styles.board}>
                {/* My Team */}
                <View style={styles.teamContainer}>
                    <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>{myTeamName}</Text>
                    <ScoreGesture team="myTeam">
                        {readOnly ? (
                            <Text style={[styles.score, styles.myScore, { color: colors.primary }]}>{score.myTeam}</Text>
                        ) : (
                            <TouchableOpacity onLongPress={() => onScoreLongPress('myTeam')} activeOpacity={0.8}>
                                <Text style={[styles.score, styles.myScore, { color: colors.primary }]}>{score.myTeam}</Text>
                            </TouchableOpacity>
                        )}
                    </ScoreGesture>
                    {readOnly ? (
                        <View style={styles.serveIndicator}>
                            <Volleyball size={16} color={servingTeam === 'myTeam' ? colors.primary : colors.border} />
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => servingTeam !== 'myTeam' && onToggleServe()}
                            disabled={servingTeam === 'myTeam'}
                            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                            style={styles.serveIndicator}
                        >
                            <Volleyball size={16} color={servingTeam === 'myTeam' ? colors.primary : colors.border} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Opponent */}
                <View style={styles.teamContainer}>
                    <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>{opponentName}</Text>
                    <ScoreGesture team="opponent">
                        {readOnly ? (
                            <Text style={[styles.score, styles.opponentScore, { color: colors.opponent }]}>{score.opponent}</Text>
                        ) : (
                            <TouchableOpacity onLongPress={() => onScoreLongPress('opponent')} activeOpacity={0.8}>
                                <Text style={[styles.score, styles.opponentScore, { color: colors.opponent }]}>{score.opponent}</Text>
                            </TouchableOpacity>
                        )}
                    </ScoreGesture>
                    {readOnly ? (
                        <View style={styles.serveIndicator}>
                            <Volleyball size={16} color={servingTeam === 'opponent' ? colors.opponent : colors.border} />
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => servingTeam !== 'opponent' && onToggleServe()}
                            disabled={servingTeam === 'opponent'}
                            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                            style={styles.serveIndicator}
                        >
                            <Volleyball size={16} color={servingTeam === 'opponent' ? colors.opponent : colors.border} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Timeouts Row - Both Teams (hidden in spectator mode) */}
            {!readOnly && (
                <View style={[styles.timeoutsRow, { borderTopColor: colors.border }]}>
                    {/* My Team Timeouts */}
                    <View style={styles.timeoutTeamContainer}>
                        <TouchableOpacity
                            onPress={() => onUseTimeout('myTeam')}
                            disabled={timeoutsRemaining.myTeam === 0}
                            style={[styles.useToBtn, timeoutsRemaining.myTeam === 0 && styles.useToBtnDisabled, { backgroundColor: timeoutsRemaining.myTeam === 0 ? colors.buttonDisabled : colors.primaryLight }]}
                        >
                            <Text style={[styles.useToText, timeoutsRemaining.myTeam === 0 && styles.useToTextDisabled, { color: timeoutsRemaining.myTeam === 0 ? colors.buttonDisabledText : colors.text }]}>TO</Text>
                        </TouchableOpacity>
                        <View style={styles.toDots}>
                            {[...Array(configTimeouts)].map((_, i) => {
                                const isAvailable = i < timeoutsRemaining.myTeam;
                                return (
                                    <View key={i} style={[styles.toDot, { backgroundColor: isAvailable ? colors.primary : colors.border }]} />
                                );
                            })}
                        </View>
                    </View>

                    {/* Invisible divider text ensures spacer matches the score divider width exactly */}
                    <View style={styles.divider}>
                        <Text style={[styles.dividerText, { opacity: 0 }]}>-</Text>
                    </View>

                    {/* Opponent Timeouts */}
                    <View style={styles.timeoutTeamContainer}>
                        <TouchableOpacity
                            onPress={() => onUseTimeout('opponent')}
                            disabled={timeoutsRemaining.opponent === 0}
                            style={[styles.useToBtnOpp, timeoutsRemaining.opponent === 0 && styles.useToBtnDisabled, { backgroundColor: timeoutsRemaining.opponent === 0 ? colors.buttonDisabled : colors.opponentLight }]}
                        >
                            <Text style={[styles.useToText, timeoutsRemaining.opponent === 0 && styles.useToTextDisabled, { color: timeoutsRemaining.opponent === 0 ? colors.buttonDisabledText : colors.text }]}>TO</Text>
                        </TouchableOpacity>
                        <View style={styles.toDots}>
                            {[...Array(configTimeouts)].map((_, i) => {
                                const isAvailable = i < timeoutsRemaining.opponent;
                                return (
                                    <View key={i} style={[styles.toDot, { backgroundColor: isAvailable ? colors.opponent : colors.border }]} />
                                );
                            })}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent', // Themed via inline style
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
        gap: 6,
    },
    timeoutsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        // borderTopColor themed inline
    },
    timeoutTeamContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: 1,
    },
    toDots: {
        flexDirection: 'row',
        gap: 3,
    },
    toDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    useToBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor themed inline
    },
    useToBtnOpp: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor themed inline
    },
    useToBtnDisabled: {
        // backgroundColor themed inline
    },
    useToText: {
        fontSize: 13,
        fontWeight: '700',
        // color themed inline
    },
    useToTextDisabled: {
        // color themed inline
    },
    pillsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    pill: {
        minWidth: 32,
        paddingHorizontal: 6,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor themed inline
    },
    pillActive: {
        // backgroundColor themed inline
    },
    pillFuture: {
        borderWidth: 1,
        // backgroundColor, borderColor themed inline
    },
    pillWonMy: {
        // backgroundColor themed inline
    },
    pillWonOpp: {
        // backgroundColor themed inline
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
        // color themed inline
    },
    pillTextActive: {
        // color themed inline
    },
    pillTextFuture: {
        // color themed inline
    },
    statusText: {
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        // color themed inline
    },
    statusContainer: {
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    board: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamContainer: {
        flex: 1,
        alignItems: 'center',
    },
    teamName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        // color themed inline
    },
    score: {
        fontSize: 64,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        lineHeight: 70,
    },
    myScore: {
        // color themed inline
    },
    opponentScore: {
        // color themed inline
    },
    divider: {
        paddingHorizontal: 10,
    },
    dividerText: {
        fontSize: 32,
        fontWeight: '300',
        // color themed inline
    },
    serveIndicator: {
        marginTop: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
