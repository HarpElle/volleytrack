import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Save, Star, WifiOff } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LAST_ACTIVE_SPECTATOR_KEY, LastActiveSpectator } from '../../constants/spectator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdBanner } from '../../components/AdBanner';
import FullLogModal from '../../components/FullLogModal';
import LineupTracker from '../../components/LineupTracker';
import { PaywallModal } from '../../components/PaywallModal';
import { ReactionFloater } from '../../components/ReactionFloater';
import ScoreBoard from '../../components/ScoreBoard';
import { ActivityFanZoneToggle, ContentTab } from '../../components/spectator/ActivityFanZoneToggle';
import { AlertTypeModal } from '../../components/spectator/AlertTypeModal';
import { EmergencyAlertModal } from '../../components/spectator/EmergencyAlertModal';
import { FanZoneInline } from '../../components/spectator/FanZoneInline';
import { PlayerSetSummary } from '../../components/spectator/PlayerSetSummary';
import { ProudMomentCard } from '../../components/spectator/ProudMomentCard';
import { ReactionDrawer } from '../../components/spectator/ReactionDrawer';
import { ScoreCorrectionModal } from '../../components/spectator/ScoreCorrectionModal';
import { SpectatorQuickGuide } from '../../components/spectator/SpectatorQuickGuide';
import { SpectatorShareModal } from '../../components/spectator/SpectatorShareModal';
// Phase 3 components (Enhancements 6 & 9)
import { BetweenSetsView } from '../../components/spectator/BetweenSetsView';
import { EmojiRain } from '../../components/spectator/EmojiRain';
import { LivePulse } from '../../components/spectator/LivePulse';
import { MatchCompleteView } from '../../components/spectator/MatchCompleteView';
import { MomentumBanner } from '../../components/spectator/MomentumBanner';
import { SpectatorLobbyModal } from '../../components/SpectatorLobbyModal';
import { SpectatorOnboardingModal } from '../../components/SpectatorOnboardingModal';
import { SpectatorReactionBar } from '../../components/SpectatorReactionBar';
import { SuperFanRecapModal } from '../../components/SuperFanRecapModal';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useFanZoneChat } from '../../hooks/useFanZoneChat';
import { useIncomingReactions } from '../../hooks/useIncomingReactions';
import { useMatchSounds } from '../../hooks/useMatchSounds';
import { useMomentumDetection } from '../../hooks/useMomentumDetection';
import { useSpectatorInteractions } from '../../hooks/useSpectatorInteractions';
import { useSpectatorMatch } from '../../hooks/useSpectatorMatch';
import { sendCelebrationMessage } from '../../services/firebase/spectatorChatService';
import { useDataStore } from '../../store/useDataStore';
import { MatchRecord, Player, Score, StatLog } from '../../types';

// Stat types that end a rally and award a point
const POINT_SCORERS = ['ace', 'kill', 'block'];
const POINT_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'drop'];

function isRallyEnding(type: string): boolean {
    return POINT_SCORERS.includes(type) || POINT_ERRORS.includes(type);
}

/**
 * Compute the score AFTER a rally-ending event.
 */
function getResultScore(event: StatLog): { myTeam: number; opponent: number } | null {
    if (!isRallyEnding(event.type)) return null;

    const before = event.scoreSnapshot;
    const isError = POINT_ERRORS.includes(event.type);
    const winner = isError
        ? (event.team === 'myTeam' ? 'opponent' : 'myTeam')
        : event.team;

    return {
        myTeam: before.myTeam + (winner === 'myTeam' ? 1 : 0),
        opponent: before.opponent + (winner === 'opponent' ? 1 : 0),
    };
}

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

    useKeepAwake();

    // Spectator interactions (alerts, cheers, viewer presence)
    const interactions = useSpectatorInteractions(code || '', match);
    const incomingReactions = useIncomingReactions(code || '');

    // Fan Zone Chat (Enhancement 3)
    const fanChat = useFanZoneChat(
        code || '',
        interactions.deviceId,
        interactions.viewerName || 'Fan'
    );

    // Match haptics (Enhancement 9)
    const matchSounds = useMatchSounds({ hapticsEnabled: true });

    // Modal states
    const [showFanRecap, setShowFanRecap] = useState(false);
    const [showFullLog, setShowFullLog] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showLobby, setShowLobby] = useState(false);

    // Phase 1 modal states
    const [showAlertTypeModal, setShowAlertTypeModal] = useState(false);
    const [showScoreCorrection, setShowScoreCorrection] = useState(false);
    const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
    const [showShare, setShowShare] = useState(false);

    // Phase 2 states
    const [showReactionDrawer, setShowReactionDrawer] = useState(false);
    const [activeContentTab, setActiveContentTab] = useState<ContentTab>('activity');
    const [showQuickGuide, setShowQuickGuide] = useState(false);

    // Proud Moment Card state (Enhancement 7)
    const [proudMoment, setProudMoment] = useState<{
        playerName: string;
        jerseyNumber?: string;
        eventType: string;
    } | null>(null);
    const lastProudMomentTimeRef = useRef(0);
    const proudMomentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Player Set Summary state (Enhancement 7)
    const [setForSummary, setSetForSummary] = useState<number | null>(null);
    const [summaryPlayer, setSummaryPlayer] = useState<Player | null>(null);
    const prevSetNumberRef = useRef<number | null>(null);

    // Emoji Rain trigger state (Enhancement 6)
    const [showEmojiRain, setShowEmojiRain] = useState(false);

    // Track peak viewers (Enhancement 9 — MatchCompleteView)
    const peakViewersRef = useRef(0);

    const state = match?.currentState;
    const isMatchEnded = state?.status === 'completed' || match?.isActive === false;
    const isBetweenSets = state?.status === 'between-sets';

    // ── Exit guard: beforeRemove (iOS / Expo Router) ──────────────────────────
    const navigation = useNavigation();

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (!match || !match.isActive) return;
            e.preventDefault();
            Alert.alert(
                'Leave this match?',
                'The match is still in progress.',
                [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
                ]
            );
        });
        return unsubscribe;
    }, [navigation, match?.isActive]);

    // ── Exit guard: Android hardware back button ───────────────────────────────
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!match?.isActive) return false;
            Alert.alert(
                'Leave this match?',
                'The match is still in progress.',
                [
                    { text: 'Stay', style: 'cancel', onPress: () => {} },
                    { text: 'Leave', style: 'destructive', onPress: () => router.back() },
                ]
            );
            return true;
        });
        return () => sub.remove();
    }, [match?.isActive, router]);

    // ── AsyncStorage: persist active spectator session ────────────────────────
    useEffect(() => {
        if (!match?.isActive || !isConnected) return;

        const teamNames = `${match.currentState?.myTeamName ?? 'Home'} vs ${match.currentState?.opponentName ?? 'Away'}`;
        const payload: LastActiveSpectator = {
            matchCode: (code as string) ?? '',
            matchName: teamNames,
            lastSeen: Date.now(),
        };
        AsyncStorage.setItem(LAST_ACTIVE_SPECTATOR_KEY, JSON.stringify(payload));
    }, [match?.isActive, isConnected, code, match?.currentState?.myTeamName, match?.currentState?.opponentName]);

    // ── AsyncStorage: clear on match end ─────────────────────────────────────
    useEffect(() => {
        if (isMatchEnded) {
            AsyncStorage.removeItem(LAST_ACTIVE_SPECTATOR_KEY);
        }
    }, [isMatchEnded]);

    const noOp = () => { };

    // Track previous rotation for check-in alerts
    const prevRotationRef = useRef<string[]>([]);

    // Track history length for celebration + proud moment detection
    const prevHistoryLenRef = useRef(0);

    const currentScore = useMemo(
        () => state ? (state.scores[state.currentSet - 1] || { myTeam: 0, opponent: 0 }) : { myTeam: 0, opponent: 0 },
        [state?.scores, state?.currentSet]
    );
    const setConfig = useMemo(
        () => state ? (state.config.sets[state.currentSet - 1] || { targetScore: 25, winBy: 2, cap: 100 }) : { targetScore: 25, winBy: 2, cap: 100 },
        [state?.config?.sets, state?.currentSet]
    );

    // Recent events for activity feed (must be before any early returns for Rules of Hooks)
    const recentEvents = useMemo(
        () => state
            ? (state.history || [])
                .filter(e => e.setNumber === state.currentSet)
                .filter(e => !['rotation'].includes(e.type) && !e.metadata?.isAssignment)
                .slice(-15)
                .reverse()
            : [],
        [state?.history, state?.currentSet]
    );

    // Cheering-for set (must be before any early returns for Rules of Hooks)
    const cheeringForSet = useMemo(
        () => new Set(interactions.cheeringFor || []),
        [interactions.cheeringFor]
    );

    // Momentum detection (Enhancement 6) — memoize props to avoid recalc
    const momentumProps = useMemo(() => ({
        history: state?.history || [],
        currentSet: state?.currentSet || 1,
        currentScore,
        setsWon: state?.setsWon || { myTeam: 0, opponent: 0 },
        config: state?.config || { presetName: '3-Set', totalSets: 3, sets: [{ targetScore: 25, winBy: 2, cap: 30 }] },
        myTeamName: state?.myTeamName || '',
        opponentName: state?.opponentName || '',
        cheeringFor: interactions.cheeringFor,
        myTeamRoster: state?.myTeamRoster || [],
        servingTeam: state?.servingTeam || 'myTeam',
        status: state?.status || 'live',
    }), [
        state?.history?.length, state?.currentSet, currentScore,
        state?.setsWon, state?.config, state?.myTeamName, state?.opponentName,
        interactions.cheeringFor, state?.myTeamRoster, state?.servingTeam, state?.status,
    ]);
    const momentum = useMomentumDetection(momentumProps);

    // Trigger emoji rain when momentum says so (myTeam events only)
    useEffect(() => {
        if (momentum.activeBanner?.triggerRain && momentum.activeBanner?.team !== 'opponent') {
            setShowEmojiRain(true);
        }
    }, [momentum.activeBanner]);

    // Track peak viewers
    useEffect(() => {
        if (interactions.viewerCount > peakViewersRef.current) {
            peakViewersRef.current = interactions.viewerCount;
        }
    }, [interactions.viewerCount]);

    // Haptic feedback for game events (Enhancement 9)
    useEffect(() => {
        if (state?.history) {
            matchSounds.processNewEvents(state.history);
        }
    }, [state?.history?.length]);

    // Check-in Alert Logic
    useEffect(() => {
        if (!state?.currentRotation || !interactions.cheeringFor || interactions.cheeringFor.length === 0) return;

        const currentIds = state.currentRotation
            .map(pos => pos.playerId)
            .filter((id): id is string => !!id);

        const prevIds = prevRotationRef.current;
        const newPlayers = currentIds.filter(id => !prevIds.includes(id));
        const cheeringForIds = interactions.cheeringFor;
        const relevantCheckIns = newPlayers.filter(id => cheeringForIds.includes(id));

        if (relevantCheckIns.length > 0) {
            const playerNames = relevantCheckIns.map(id => {
                const p = state.myTeamRoster?.find(r => r.id === id);
                return p ? p.name : 'Your player';
            }).join(' and ');

            Alert.alert('Player Check-In!', `${playerNames} is now on the court!`);
        }

        prevRotationRef.current = currentIds;
    }, [state?.currentRotation, interactions.cheeringFor, state?.myTeamRoster]);

    // Auto-generate celebration messages + Proud Moment cards for new plays
    useEffect(() => {
        if (!state?.history || !code) return;

        const historyLen = state.history.length;
        if (historyLen <= prevHistoryLenRef.current) {
            prevHistoryLenRef.current = historyLen;
            return;
        }

        const newEvents = state.history.slice(prevHistoryLenRef.current);
        prevHistoryLenRef.current = historyLen;

        for (const event of newEvents) {
            // Celebration messages for home team big plays
            if (event.team === 'myTeam' && POINT_SCORERS.includes(event.type) && event.playerId) {
                const player = state.myTeamRoster?.find(p => p.id === event.playerId);
                if (player) {
                    sendCelebrationMessage(
                        code,
                        event.type,
                        player.name,
                        player.jerseyNumber
                    );
                }

                // Proud Moment Card if player is cheered-for (30s cooldown)
                if (
                    interactions.cheeringFor?.includes(event.playerId) &&
                    Date.now() - lastProudMomentTimeRef.current > 30_000
                ) {
                    lastProudMomentTimeRef.current = Date.now();
                    setProudMoment({
                        playerName: player?.name || 'Your player',
                        jerseyNumber: player?.jerseyNumber,
                        eventType: event.type,
                    });
                    if (proudMomentTimerRef.current) clearTimeout(proudMomentTimerRef.current);
                    proudMomentTimerRef.current = setTimeout(() => setProudMoment(null), 5000);
                }
            }
        }
    }, [state?.history?.length, code, interactions.cheeringFor, state?.myTeamRoster]);

    // End-of-set detection for Player Set Summary
    useEffect(() => {
        if (!state) return;

        const currentSet = state.currentSet;
        if (prevSetNumberRef.current !== null && currentSet > prevSetNumberRef.current) {
            const completedSet = prevSetNumberRef.current;
            if (interactions.cheeringFor && interactions.cheeringFor.length > 0) {
                const playerId = interactions.cheeringFor[0];
                const player = state.myTeamRoster?.find(p => p.id === playerId);
                if (player) {
                    setSummaryPlayer(player);
                    setSetForSummary(completedSet);
                }
            }
        }
        prevSetNumberRef.current = currentSet;
    }, [state?.currentSet, interactions.cheeringFor, state?.myTeamRoster]);

    // Handlers
    const handleScoreAlert = () => {
        if (!state) return;
        setShowScoreCorrection(true);
    };

    // Alert feedback state
    const [alertFeedback, setAlertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const alertFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (proudMomentTimerRef.current) clearTimeout(proudMomentTimerRef.current);
            if (alertFeedbackTimerRef.current) clearTimeout(alertFeedbackTimerRef.current);
        };
    }, []);

    const showAlertFeedback = (type: 'success' | 'error', message: string) => {
        if (alertFeedbackTimerRef.current) clearTimeout(alertFeedbackTimerRef.current);
        setAlertFeedback({ type, message });
        alertFeedbackTimerRef.current = setTimeout(() => setAlertFeedback(null), 1200);
    };

    const handleScoreCorrectionSubmit = async (suggestedScore: Score, message?: string) => {
        const success = await interactions.sendAlert('score_correction', {
            suggestedScore,
            message,
        });
        if (success) {
            showAlertFeedback('success', 'Score check sent to coach');
        } else {
            showAlertFeedback('error', 'Couldn\'t send alert. Try again.');
        }
    };

    const handleEmergencyAlert = () => {
        setShowEmergencyAlert(true);
    };

    const handleEmergencySubmit = async (message: string) => {
        const success = await interactions.sendAlert('emergency', { message });
        if (success) {
            showAlertFeedback('success', 'Emergency alert sent to coach');
        } else {
            showAlertFeedback('error', 'Couldn\'t send alert. Try again.');
        }
    };

    const handleCheer = async () => {
        await interactions.sendCheer();
        interactions.sendReaction('heart');
        fanChat.sendQuickReaction('heart');
    };

    // Save Match Logic
    const { saveSpectatorMatch, savedSpectatorMatches } = useDataStore();
    const isSaved = savedSpectatorMatches.some(m => m.id === match?.matchId);

    const handleSaveMatch = () => {
        if (!match || !state) return;

        const result: MatchRecord['result'] =
            match.isActive ? 'In Progress' :
                (state.setsWon.myTeam > state.setsWon.opponent ? 'Win' :
                    (state.setsWon.myTeam < state.setsWon.opponent ? 'Loss' : 'In Progress'));

        const record: MatchRecord = {
            id: match.matchId,
            opponentName: state.opponentName,
            date: match.createdAt,
            result,
            setsWon: state.setsWon,
            scores: state.scores,
            history: state.history,
            config: state.config,
            lineups: {},
        };

        saveSpectatorMatch(record);
        Alert.alert('Saved', 'This match has been saved to your history.');
    };

    const showNamePrompt = !interactions.isProfileSet && !loading && match;

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

    // Point streak indicator for score area
    const streak = momentum.currentStreak;
    const showStreak = streak.count >= 3;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
            {/* Momentum Banner (Enhancement 6) */}
            <MomentumBanner
                event={momentum.activeBanner}
                onDismiss={momentum.dismissBanner}
            />

            {/* Emoji Rain (Enhancement 6) */}
            <EmojiRain
                trigger={showEmojiRain}
                onComplete={() => setShowEmojiRain(false)}
            />

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
                        ) : (
                            <>
                                <LivePulse
                                    isLive={isConnected}
                                    isActivePlay={state.rallyState === 'in-rally'}
                                    size={8}
                                />
                                <Text style={[styles.statusText, { color: isConnected ? colors.textSecondary : colors.warning }]}>
                                    {isConnected ? 'Live' : 'Reconnecting...'}
                                </Text>
                            </>
                        )}
                    </View>
                </View>
                <TouchableOpacity onPress={handleSaveMatch} disabled={isSaved} hitSlop={12}>
                    {isSaved ? (
                        <Check size={22} color={colors.primary} />
                    ) : (
                        <Save size={22} color={colors.text} />
                    )}
                </TouchableOpacity>
            </View>

            <FlatList
                data={activeContentTab === 'activity' ? recentEvents : []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={
                    <>
                        {showNamePrompt && (
                            <SpectatorOnboardingModal
                                visible={!!showNamePrompt}
                                onComplete={(name, cheeringFor) => {
                                    interactions.joinMatch(name, cheeringFor);
                                }}
                                roster={state.myTeamRoster}
                                initialName={interactions.viewerName}
                                initialCheeringFor={interactions.cheeringFor}
                            />
                        )}

                        {/* Match Complete View (Enhancement 9) */}
                        {isMatchEnded && (
                            <MatchCompleteView
                                myTeamName={state.myTeamName}
                                opponentName={state.opponentName}
                                setsWon={state.setsWon}
                                setHistory={state.setHistory || []}
                                config={state.config}
                                cheerCount={interactions.cheerCount}
                                peakViewers={peakViewersRef.current}
                                matchCode={code || ''}
                                isSaved={isSaved}
                                onSaveMatch={handleSaveMatch}
                                onGenerateRecap={() => setShowFanRecap(true)}
                            />
                        )}

                        {/* Between Sets View (Enhancement 9) */}
                        {!isMatchEnded && isBetweenSets && (
                            <BetweenSetsView
                                currentSet={state.currentSet}
                                setsWon={state.setsWon}
                                setHistory={state.setHistory || []}
                                config={state.config}
                                myTeamName={state.myTeamName}
                                opponentName={state.opponentName}
                                onViewSetStats={() => setShowFullLog(true)}
                                onGenerateRecap={() => setShowFanRecap(true)}
                            />
                        )}

                        {/* Normal scoreboard when not showing special views */}
                        {!isMatchEnded && !isBetweenSets && (
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
                        )}

                        {/* Point streak indicator (Enhancement 6) */}
                        {showStreak && !isMatchEnded && !isBetweenSets && (
                            <View style={[styles.streakBadge, { backgroundColor: `${streak.team === 'myTeam' ? colors.momentumPositive : colors.opponent}15` }]}>
                                <Text style={[styles.streakText, { color: streak.team === 'myTeam' ? colors.momentumPositive : colors.opponent }]}>
                                    {streak.team === 'myTeam' ? '🔥' : '⚡'} {streak.count} straight!
                                </Text>
                            </View>
                        )}

                        {state?.currentRotation && state.currentRotation.length > 0 ? (
                            <LineupTracker
                                rotation={state.currentRotation}
                                roster={state.myTeamRoster || []}
                                onSubstitute={() => {}}
                                onSelectPlayer={() => {}}
                                readOnly
                            />
                        ) : null}

                        {/* Activity / Fan Zone toggle */}
                        <ActivityFanZoneToggle
                            activeTab={activeContentTab}
                            onTabChange={(tab) => {
                                setActiveContentTab(tab);
                                if (tab === 'fan-zone') {
                                    fanChat.setIsOpen(true);
                                } else {
                                    fanChat.setIsOpen(false);
                                }
                            }}
                            unreadCount={activeContentTab === 'activity' ? fanChat.unreadCount : 0}
                        />

                        {/* Fan Zone inline (replaces modal) */}
                        {activeContentTab === 'fan-zone' && (
                            <FanZoneInline
                                messages={fanChat.messages}
                                isLoading={fanChat.isLoading}
                                viewerCount={interactions.viewerCount}
                                canSend={fanChat.canSend}
                                currentDeviceId={interactions.deviceId}
                                onSendMessage={fanChat.sendMessage}
                                onSendQuickReaction={fanChat.sendQuickReaction}
                            />
                        )}
                    </>
                }
                renderItem={({ item }) => {
                    const resultScore = getResultScore(item);
                    const isMyPlayer = item.playerId ? cheeringForSet.has(item.playerId) : false;
                    const playerInfo = isMyPlayer && item.playerId
                        ? state.myTeamRoster.find(p => p.id === item.playerId)
                        : null;

                    return (
                        <View
                            style={[
                                styles.eventRow,
                                { borderBottomColor: colors.border },
                                isMyPlayer && { backgroundColor: `${colors.primary}10` },
                            ]}
                        >
                            {isMyPlayer ? (
                                <Star size={14} color={colors.primary} fill={colors.primary} />
                            ) : (
                                <View style={[styles.eventDot, { backgroundColor: item.team === 'myTeam' ? colors.primary : colors.opponent }]} />
                            )}
                            <Text style={[styles.eventText, { color: colors.text, fontWeight: isMyPlayer ? '700' : '500' }]}>
                                {formatEvent(item)}
                                {playerInfo && ` — #${playerInfo.jerseyNumber} ${playerInfo.name}`}
                            </Text>
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
                ListFooterComponent={
                    (!loading && !error) ? (
                        <TouchableOpacity
                            style={[styles.fullLogBtn, { borderColor: colors.border }]}
                            onPress={() => setShowFullLog(true)}
                        >
                            <Text style={[styles.fullLogBtnText, { color: colors.primary }]}>View Full Match Log</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <AdBanner />
            <ReactionFloater reactions={incomingReactions} />

            {/* Proud Moment Card (Enhancement 7) */}
            {proudMoment && state && (
                <ProudMomentCard
                    visible={!!proudMoment}
                    playerName={proudMoment.playerName}
                    jerseyNumber={proudMoment.jerseyNumber}
                    eventType={proudMoment.eventType}
                    teamName={state.myTeamName}
                    score={currentScore}
                    currentSet={state.currentSet}
                    matchCode={code || ''}
                    onDismiss={() => {
                        if (proudMomentTimerRef.current) clearTimeout(proudMomentTimerRef.current);
                        setProudMoment(null);
                    }}
                />
            )}

            {/* Reaction Drawer (Enhancement 5) */}
            <ReactionDrawer
                visible={showReactionDrawer}
                onClose={() => setShowReactionDrawer(false)}
                onReaction={async (type) => {
                    try {
                        await interactions.sendReaction(type);
                    } catch (err) {
                        console.warn('Reaction failed:', err);
                    }
                    setShowReactionDrawer(false);
                }}
            />

            {/* First-time quick guide */}
            <SpectatorQuickGuide
                onboardingComplete={interactions.isProfileSet}
                forceShow={showQuickGuide}
                onDismiss={() => setShowQuickGuide(false)}
            />

            {/* Alert feedback banner */}
            {alertFeedback && (
                <View style={[
                    styles.alertFeedback,
                    { backgroundColor: alertFeedback.type === 'success' ? '#16a34a' : '#dc2626' }
                ]}>
                    <Text style={styles.alertFeedbackText}>
                        {alertFeedback.type === 'success' ? '✓ ' : '✕ '}{alertFeedback.message}
                    </Text>
                </View>
            )}

            {/* Spectator Reaction Bar */}
            <SpectatorReactionBar
                viewerCount={interactions.viewerCount}
                cheerCount={interactions.cheerCount}
                cheerBurst={interactions.cheerBurst}
                canSendCheer={interactions.canSendCheer}
                canSendAlert={interactions.canSendAlert}
                alertCooldownRemaining={interactions.alertCooldownRemaining}
                isMatchEnded={isMatchEnded}
                onCheer={handleCheer}
                onOpenLobby={() => setShowLobby(true)}
                onOpenReactionDrawer={() => setShowReactionDrawer(!showReactionDrawer)}
                onOpenAlertModal={() => setShowAlertTypeModal(true)}
                onFanRecap={() => {
                    if (!isMatchEnded && !isBetweenSets) {
                        showAlertFeedback('success', 'Recaps available when the match ends!');
                        return;
                    }
                    setShowFanRecap(true);
                }}
                onOpenQuickGuide={() => setShowQuickGuide(true)}
                alertsAllowed={interactions.alertsAllowed}
                recentAlertInfo={interactions.recentAlertInfo}
            />

            {/* Modals */}
            <AlertTypeModal
                visible={showAlertTypeModal}
                onClose={() => setShowAlertTypeModal(false)}
                onScoreCheck={() => setShowScoreCorrection(true)}
                onEmergencyStop={() => setShowEmergencyAlert(true)}
                alertsAllowed={interactions.alertsAllowed}
                canSendAlert={interactions.canSendAlert}
                cooldownSeconds={Math.ceil(interactions.alertCooldownRemaining / 1000)}
                recentAlertInfo={interactions.recentAlertInfo}
            />

            <ScoreCorrectionModal
                visible={showScoreCorrection}
                onClose={() => setShowScoreCorrection(false)}
                onSubmit={handleScoreCorrectionSubmit}
                currentScore={currentScore}
                myTeamName={state.myTeamName}
                opponentName={state.opponentName}
                currentSet={state.currentSet}
                canSendAlert={interactions.canSendAlert}
                cooldownRemaining={interactions.alertCooldownRemaining}
            />

            <EmergencyAlertModal
                visible={showEmergencyAlert}
                onClose={() => setShowEmergencyAlert(false)}
                onSubmit={handleEmergencySubmit}
                canSendAlert={interactions.canSendAlert}
                cooldownRemaining={interactions.alertCooldownRemaining}
            />

            <SpectatorShareModal
                visible={showShare}
                onClose={() => setShowShare(false)}
                matchCode={code || ''}
                teamName={state.myTeamName}
            />

            {summaryPlayer && setForSummary && (
                <PlayerSetSummary
                    visible={!!summaryPlayer}
                    onClose={() => {
                        setSummaryPlayer(null);
                        setSetForSummary(null);
                    }}
                    player={summaryPlayer}
                    setNumber={setForSummary}
                    history={state.history}
                    teamName={state.myTeamName}
                    matchCode={code || ''}
                />
            )}

            <SpectatorLobbyModal
                visible={showLobby}
                onClose={() => setShowLobby(false)}
                viewers={interactions.viewers}
                roster={state.myTeamRoster}
                currentViewerId={interactions.deviceId}
                onShare={() => setShowShare(true)}
            />

            <SuperFanRecapModal
                visible={showFanRecap}
                onClose={() => setShowFanRecap(false)}
                match={match}
                onShowPaywall={() => {
                    setShowFanRecap(false);
                    setShowPaywall(true);
                }}
            />

            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                trigger="ai_narrative"
            />

            <FullLogModal
                visible={showFullLog}
                onClose={() => setShowFullLog(false)}
                history={state.history}
                roster={state.myTeamRoster}
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
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 80,
    },
    streakBadge: {
        alignSelf: 'center',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 4,
    },
    streakText: {
        fontSize: 13,
        fontWeight: '800',
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
        paddingHorizontal: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
        borderRadius: 6,
        marginBottom: 1,
    },
    eventDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    eventText: {
        flex: 1,
        fontSize: 14,
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
    fullLogBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 16,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    fullLogBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    alertFeedback: {
        alignSelf: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 4,
    },
    alertFeedbackText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
});
