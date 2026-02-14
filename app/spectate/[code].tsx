import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Radio, WifiOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useSpectatorMatch } from '../../hooks/useSpectatorMatch';
import { useSpectatorInteractions } from '../../hooks/useSpectatorInteractions';
import ScoreBoard from '../../components/ScoreBoard';
import LineupTracker from '../../components/LineupTracker';
import { AdBanner } from '../../components/AdBanner';
import { SpectatorNamePrompt } from '../../components/SpectatorNamePrompt';
import { SpectatorReactionBar } from '../../components/SpectatorReactionBar';
import { SuperFanRecapModal } from '../../components/SuperFanRecapModal';
import { PaywallModal } from '../../components/PaywallModal';
import { StatLog } from '../../types';

// Stat types that end a rally and award a point
const POINT_SCORERS = ['ace', 'kill', 'block'];
const POINT_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'drop'];

function isRallyEnding(type: string): boolean {
    return POINT_SCORERS.includes(type) || POINT_ERRORS.includes(type);
}

/**
 * Compute the score AFTER a rally-ending event.
 * Scorers give a point to the acting team; errors give a point to the other team.
 */
function getResultScore(event: StatLog): { myTeam: number; opponent: number } | null {
    if (!isRallyEnding(event.type)) return null;

    const before = event.scoreSnapshot;
    const isError = POINT_ERRORS.includes(event.type);
    // Errors award a point to the opposing team; scorers award to the acting team
    const winner = isError
        ? (event.team === 'myTeam' ? 'opponent' : 'myTeam')
        : event.team;

    return {
        myTeam: before.myTeam + (winner === 'myTeam' ? 1 : 0),
        opponent: before.opponent + (winner === 'opponent' ? 1 : 0),
    };
}

// Format a StatLog entry for display
// myTeam actions show label only; opponent actions append "- Opponent"
function formatEvent(event: StatLog): string {
    const typeLabels: Record<string, string> = {
        ace: 'Ace',
        serve_error: 'Serve Error',
        serve_good: 'Good Serve',
        kill: 'Kill',
        attack_error: 'Attack Error',
        attack_good: 'Good Attack',
        block: 'Block',
        dig: 'Dig',
        dig_error: 'Dig Error',
        pass_error: 'Pass Error',
        receive_error: 'Receive Error',
        receive_0: 'Reception Error',
        receive_1: 'Receive (1)',
        receive_2: 'Receive (2)',
        receive_3: 'Receive (3)',
        set_error: 'Setting Error',
        drop: 'Ball Dropped',
        no_play: 'No Play',
        timeout: 'Timeout',
        substitution: 'Substitution',
        rotation: 'Rotation',
        point_adjust: 'Point',
    };
    const label = typeLabels[event.type] || event.type;
    if (event.team === 'opponent') {
        return `${label} - Opponent`;
    }
    return label;
}

export default function SpectateScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const { colors } = useAppTheme();
    const { match, loading, error, isConnected } = useSpectatorMatch(code || '');

    // Spectator interactions (alerts, cheers, viewer presence)
    const interactions = useSpectatorInteractions(code || '', match);

    // Modal states
    const [showFanRecap, setShowFanRecap] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [namePromptDismissed, setNamePromptDismissed] = useState(false);

    const state = match?.currentState;
    const isMatchEnded = state?.status === 'completed' || match?.isActive === false;

    // Recent events for play-by-play (last 15, reversed for newest-first)
    // Filter out rotations and initial lineup assignments (not real game actions)
    const recentEvents = (state?.history || [])
        .filter(e => !['rotation'].includes(e.type) && !e.metadata?.isAssignment)
        .slice(-15)
        .reverse();

    const noOp = () => {};

    // Handle score correction alert
    const handleScoreAlert = () => {
        if (!state) return;

        const currentScore = state.scores[state.currentSet - 1] || { myTeam: 0, opponent: 0 };

        Alert.alert(
            'Score Check',
            `Current score is ${currentScore.myTeam}-${currentScore.opponent} in Set ${state.currentSet}.\n\nSend a notification to the coach that the score may need checking?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Alert',
                    onPress: async () => {
                        const success = await interactions.sendAlert(
                            undefined,
                            'A spectator thinks the score may need checking'
                        );
                        if (success) {
                            Alert.alert('Sent', 'The coach has been notified.');
                        }
                    },
                },
            ]
        );
    };

    // Handle cheer
    const handleCheer = async () => {
        await interactions.sendCheer();
    };

    // Show name prompt?
    const showNamePrompt = !interactions.isNameSet && !namePromptDismissed && !loading && match;

    // Loading state
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Connecting to match...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (error && !match) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
                <View style={styles.centered}>
                    <WifiOff size={48} color={colors.textTertiary} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>
                        {error === 'Match not found' ? 'Match Not Found' : 'Connection Error'}
                    </Text>
                    <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
                        {error === 'Match not found'
                            ? `No live match with code "${code}"`
                            : 'Check your internet connection and try again.'}
                    </Text>
                    <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!state) return null;

    const currentScore = state.scores[state.currentSet - 1] || { myTeam: 0, opponent: 0 };
    const setConfig = state.config.sets[state.currentSet - 1] || { targetScore: 25, winBy: 2, cap: 100 };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
                    <ArrowLeft size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {state.myTeamName} vs {state.opponentName}
                    </Text>
                    <View style={styles.statusRow}>
                        {isMatchEnded ? (
                            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Match Ended</Text>
                        ) : isConnected ? (
                            <>
                                <View style={[styles.statusDot, { backgroundColor: '#4caf50' }]} />
                                <Text style={[styles.statusText, { color: colors.textSecondary }]}>Live</Text>
                            </>
                        ) : (
                            <>
                                <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                                <Text style={[styles.statusText, { color: colors.warning }]}>Reconnecting...</Text>
                            </>
                        )}
                    </View>
                </View>
                <View style={{ width: 22 }} />
            </View>

            <FlatList
                data={recentEvents}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={
                    <>
                        {/* Name prompt for first-time spectators */}
                        {showNamePrompt && (
                            <SpectatorNamePrompt
                                onSubmit={(name) => {
                                    interactions.setViewerName(name);
                                    setNamePromptDismissed(true);
                                }}
                                onSkip={() => setNamePromptDismissed(true)}
                            />
                        )}

                        {/* Match ended banner */}
                        {isMatchEnded && (
                            <View style={[styles.endBanner, { backgroundColor: colors.primaryLight }]}>
                                <Radio size={18} color={colors.primary} />
                                <Text style={[styles.endBannerText, { color: colors.primary }]}>
                                    {match?.isActive === false ? 'Sharing has ended' : 'Match Complete'}
                                </Text>
                            </View>
                        )}

                        {/* ScoreBoard (read-only) */}
                        <ScoreBoard
                            myTeamName={state.myTeamName}
                            opponentName={state.opponentName}
                            currentSet={state.currentSet}
                            score={currentScore}
                            setsWon={state.setsWon}
                            setConfig={setConfig}
                            config={state.config}
                            setHistory={state.setHistory}
                            onScoreLongPress={noOp}
                            servingTeam={state.servingTeam}
                            onToggleServe={noOp}
                            timeoutsRemaining={state.timeoutsRemaining}
                            onUseTimeout={noOp}
                            configTimeouts={state.config.timeoutsPerSet || 2}
                            onIncrement={noOp}
                            onDecrement={noOp}
                            readOnly
                        />

                        {/* Set context */}
                        <View style={styles.setContext}>
                            <Text style={[styles.setContextText, { color: colors.textTertiary }]}>
                                Set {state.currentSet} of {state.config.totalSets}
                                {state.servingTeam === 'myTeam' ? ` · ${state.myTeamName} serving` : ` · ${state.opponentName} serving`}
                            </Text>
                        </View>

                        {/* LineupTracker (read-only) */}
                        {state.currentRotation && state.currentRotation.length > 0 && (
                            <View style={[styles.lineupCard, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Lineup</Text>
                                <LineupTracker
                                    rotation={state.currentRotation}
                                    roster={state.myTeamRoster}
                                    onSubstitute={noOp}
                                    onSelectPlayer={noOp}
                                    readOnly
                                />
                            </View>
                        )}

                        {/* Play-by-play header */}
                        {recentEvents.length > 0 && (
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>
                                Recent Activity
                            </Text>
                        )}
                    </>
                }
                renderItem={({ item }) => {
                    const resultScore = getResultScore(item);
                    return (
                        <View style={[styles.eventRow, { borderBottomColor: colors.border }]}>
                            <View style={[styles.eventDot, { backgroundColor: item.team === 'myTeam' ? colors.primary : colors.opponent }]} />
                            <Text style={[styles.eventText, { color: colors.text }]}>{formatEvent(item)}</Text>
                            {resultScore ? (
                                <Text style={[styles.eventScore, { color: colors.text, fontWeight: '700' }]}>
                                    {resultScore.myTeam}-{resultScore.opponent}
                                </Text>
                            ) : (
                                <Text style={[styles.eventScore, { color: colors.textTertiary }]}>
                                    {item.scoreSnapshot.myTeam}-{item.scoreSnapshot.opponent}
                                </Text>
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyEvents}>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                {isMatchEnded ? 'No activity recorded' : 'Waiting for action...'}
                            </Text>
                        </View>
                    ) : null
                }
            />

            {/* Ad Banner */}
            <AdBanner />

            {/* Spectator Reaction Bar (replaces old static footer) */}
            <SpectatorReactionBar
                viewerCount={interactions.viewerCount}
                cheerCount={interactions.cheerCount}
                cheerBurst={interactions.cheerBurst}
                canSendCheer={interactions.canSendCheer}
                canSendAlert={interactions.canSendAlert}
                alertCooldownRemaining={interactions.alertCooldownRemaining}
                matchCode={code || ''}
                onCheer={handleCheer}
                onAlert={handleScoreAlert}
                onFanRecap={() => setShowFanRecap(true)}
            />

            {/* Super Fan Recap Modal */}
            <SuperFanRecapModal
                visible={showFanRecap}
                onClose={() => setShowFanRecap(false)}
                match={match}
                onShowPaywall={() => {
                    setShowFanRecap(false);
                    setShowPaywall(true);
                }}
            />

            {/* Paywall Modal */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="ai_narrative"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    loadingText: {
        fontSize: 15,
        marginTop: 12,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 16,
    },
    errorSub: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    backBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        marginTop: 8,
    },
    backBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerBack: {
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 80,
    },
    endBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    endBannerText: {
        fontSize: 14,
        fontWeight: '700',
    },
    setContext: {
        alignItems: 'center',
        marginTop: 8,
    },
    setContextText: {
        fontSize: 12,
        fontWeight: '600',
    },
    lineupCard: {
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    eventDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    eventText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    eventScore: {
        fontSize: 12,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    emptyEvents: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyText: {
        fontSize: 14,
    },
});
