import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { AlertCircle, Eye, Maximize2, Menu, Radio, RotateCcw, RotateCw, Undo2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EndOfSetModal from '../components/EndOfSetModal';
import FullLogModal from '../components/FullLogModal';
import ServeChoiceModal from '../components/ServeChoiceModal';
import LineupTracker from '../components/LineupTracker';
import { MatchErrorBoundary } from '../components/MatchErrorBoundary';
import MatchSettingsModal from '../components/MatchSettingsModal';
import ShareMatchModal from '../components/ShareMatchModal';
import ScoreBoard from '../components/ScoreBoard';
import ScoreEditModal from '../components/ScoreEditModal';
import StatPickerModal from '../components/StatPickerModal';
import StatsModal from '../components/StatsModal';
import { SubstituteModalContent } from '../components/SubstituteModalContent';
import { AdBanner } from '../components/AdBanner';
import { CoachAlertToast } from '../components/CoachAlertToast';
import { useAppTheme } from '../contexts/ThemeContext';
import { useHaptics } from '../hooks/useHaptic';
import { useLiveMatch } from '../hooks/useLiveMatch';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { Player, SpectatorAlert, StatLog } from '../types';
import { MomentumState, MomentumTracker, SuggestionUrgency } from '../utils/MomentumTracker';

export default function LiveScreenWithBoundary() {
    const router = useRouter();
    return (
        <MatchErrorBoundary onReturnHome={() => router.replace('/')}>
            <LiveScreen />
        </MatchErrorBoundary>
    );
}

function LiveScreen() {
    // Keep screen awake during live match tracking
    useKeepAwake();

    const router = useRouter();
    const navigation = useNavigation();
    const { colors, spacing, radius } = useAppTheme();

    // Prevent accidental navigation away from live match
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            // Allow navigation if explicitly going to summary (match finalized)
            if (e.data?.action?.type === 'REPLACE') return;

            e.preventDefault();
            Alert.alert(
                'Leave Match?',
                'Your progress is saved. You can resume from the dashboard.',
                [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) }
                ]
            );
        });

        return unsubscribe;
    }, [navigation]);

    // Android hardware back button
    useEffect(() => {
        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            Alert.alert(
                'Leave Match?',
                'Your progress is saved. You can resume from the dashboard.',
                [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => router.back() }
                ]
            );
            return true; // Prevent default back behavior
        });

        return () => handler.remove();
    }, []);

    // Connect to store
    const {
        myTeamName, opponentName, currentSet, scores, setsWon,
        recordStat, incrementScore, decrementScore, setScore, undo,
        timeoutsRemaining, subsRemaining,
        useTimeout, useSub, startNextSet, finalizeMatch, config,
        history, setHistory, servingTeam, setServingTeam, rallyState,
        currentRotation, rotate, substitute, activeSeasonId,
        subPairs, nonLiberoDesignations, designateNonLibero,
        firstServerPerSet, setFirstServer, adjustStartingRotation,
        myTeamRoster,
    } = useMatchStore();

    // Get Roster — use season roster if available, otherwise fall back to Quick Match roster
    const { seasons } = useDataStore();
    const activeSeason = seasons.find(s => s.id === activeSeasonId);
    const roster = (activeSeason?.roster?.length ? activeSeason.roster : myTeamRoster) || [];
    const haptics = useHaptics();

    const currentScore = scores[currentSet - 1];

    // Hydration Guard: If store hasn't loaded scores yet, return null or loader
    if (!currentScore) {
        return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
    }

    // Rally Flow Logic
    const isMyServe = servingTeam === 'myTeam';
    const isOppServe = servingTeam === 'opponent';
    const isPreServe = rallyState === 'pre-serve';
    const isInRally = rallyState === 'in-rally';

    // Rally Log Logic
    const getRallyLog = () => {
        if (!history || history.length === 0) return null;

        // Filter for current set
        const setHistory = history.filter(h => h.setNumber === currentSet);
        if (setHistory.length === 0) return null;

        // Group by "Starting Score" of the events
        // We want events that share the same score SNAPSHOT (score before the event).

        const lastEvent = setHistory[setHistory.length - 1];

        // Helper to get score string from event itself
        const getScoreStr = (event: StatLog) => {
            return `${event.scoreSnapshot.myTeam}-${event.scoreSnapshot.opponent}`;
        }

        const currentStartScore = getScoreStr(lastEvent);
        const rallyEvents: StatLog[] = [];

        // Traverse backwards collecting events with same start score
        for (let i = setHistory.length - 1; i >= 0; i--) {
            if (getScoreStr(setHistory[i]) === currentStartScore) {
                rallyEvents.unshift(setHistory[i]);
            } else {
                break;
            }
        }

        return rallyEvents;
    };

    const currentRally = getRallyLog();

    // Libero Alert Effect (Illegal Rotation)
    useEffect(() => {
        if (!currentRotation) return;
        const frontRow = [4, 3, 2];
        const monitorLiberoIds = useMatchStore.getState().liberoIds || [];

        const illegalLibero = currentRotation.find(p =>
            frontRow.includes(p.position) &&
            p.playerId &&
            (p.isLibero || monitorLiberoIds.includes(p.playerId))
        );

        if (illegalLibero) {
            // Find player name for better alert
            const player = roster.find(p => p.id === illegalLibero.playerId);
            const name = player ? player.name : 'Unknown Player';
            Alert.alert(
                "Illegal Rotation",
                `Libero ${name} is in the front row (P${illegalLibero.position})!`,
                [{ text: "OK" }]
            );
        }
    }, [currentRotation]);

    // Momentum Logic
    const [momentum, setMomentum] = useState<MomentumState>({ score: 0, trend: 'stable', suggestion: { shouldTimeout: false } });
    // Track cooldown by total score at time of dismissal (not by reason string)
    const [dismissedAtScore, setDismissedAtScore] = useState<number | null>(null);

    useEffect(() => {
        if (!history || !currentScore) return;

        // Filter history for current set only to prevent bleed-over
        const currentSetHistory = history.filter(h => h.setNumber === currentSet);

        const result = MomentumTracker.analyze(currentSetHistory, currentScore, servingTeam, dismissedAtScore);
        setMomentum(result);
    }, [history.length, currentScore, servingTeam, dismissedAtScore]);

    // Auto-swap is handled in the store (rotate action).
    // UI notification is via the LineupTracker highlight.



    // Derived States
    // Serve enabled if: Pre-Serve AND My Serve
    const canServe = isPreServe && isMyServe;
    // Receive enabled if: Pre-Serve AND Opp Serve (Or if I want to log receive errors?)
    const canReceive = isPreServe && isOppServe;
    // Rally Actions enabled if: In Rally
    const inRally = isInRally;

    // Live broadcast (spectator sharing)
    const {
        isBroadcasting, matchCode: liveMatchCode, isStarting, error: broadcastError,
        startBroadcast, stopBroadcast, finalizeBroadcast,
        pendingAlerts, dismissAlert, dismissAllAlerts, viewerCount,
    } = useLiveMatch();
    const [showShare, setShowShare] = useState(false);

    // Coach alert toast — display one at a time from the queue
    const [currentToastAlert, setCurrentToastAlert] = useState<SpectatorAlert | null>(null);
    const processedAlertIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (pendingAlerts.length === 0 || currentToastAlert) return;
        // Find first unprocessed alert
        const next = pendingAlerts.find(a => !processedAlertIdsRef.current.has(a.id));
        if (next) {
            processedAlertIdsRef.current.add(next.id);
            setCurrentToastAlert(next);
            haptics('error'); // Strong haptic buzz for score alert
        }
    }, [pendingAlerts, currentToastAlert]);

    // Local state
    const [showSettings, setShowSettings] = useState(false);
    const [showEndOfSet, setShowEndOfSet] = useState(false);
    const [showFullLog, setShowFullLog] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [overrideModal, setOverrideModal] = useState<{ visible: boolean; team: 'myTeam' | 'opponent' } | null>(null);
    // Stat Picker State
    const [statPicker, setStatPicker] = useState<{
        visible: boolean;
        title: string;
        team: 'myTeam' | 'opponent';
        attribution?: string;
        descriptor?: string;
        options: { label: string; subLabel?: string; value: string; color?: string }[]
    } | null>(null);

    // Serve Choice Modal
    const [showServeChoice, setShowServeChoice] = useState(false);

    // Show serve choice modal at the start of each set (when no events exist for that set)
    useEffect(() => {
        const hasFirstServer = firstServerPerSet?.[currentSet];
        const setHasHistory = history.some(h => h.setNumber === currentSet);

        if (!hasFirstServer && !setHasHistory) {
            setShowServeChoice(true);
        }
    }, [currentSet]);

    // Determine suggested server for non-deciding sets (alternating pattern)
    const getSuggestedServer = (): 'myTeam' | 'opponent' | null => {
        if (currentSet === 1) return null; // Set 1: coin toss, no suggestion

        const isDecidingSet = currentSet === config.totalSets;
        if (isDecidingSet) return null; // Deciding set: new coin toss

        // Alternate from previous set's first server
        const prevServer = firstServerPerSet?.[currentSet - 1];
        if (!prevServer) return null;
        return prevServer === 'myTeam' ? 'opponent' : 'myTeam';
    };

    const handleServeChoice = (team: 'myTeam' | 'opponent') => {
        setServingTeam(team);
        setFirstServer(currentSet, team);

        // Auto-rotate lineup backward if opponent serves first and we have a lineup
        if (team === 'opponent' && currentRotation && currentRotation.length > 0 && currentRotation.some(p => p.playerId)) {
            adjustStartingRotation('backward');
        }

        setShowServeChoice(false);
    };

    // Non-Libero Designations Persistence


    // Helper to get attribution text
    const getAttribution = (type: 'serve' | 'attack' | 'general') => {
        if (type === 'serve') {
            // Find server
            const server = currentRotation?.find(p => p.position === 1);
            const p = server?.playerId ? roster.find(r => r.id === server.playerId) : null;
            return p ? `Credit: #${p.jerseyNumber} ${p.name}` : `Credit: ${myTeamName}`;
        }

        if (selectedPlayerIds.length > 0) {
            const p1 = roster.find(r => r.id === selectedPlayerIds[0]);

            if (type === 'attack' && selectedPlayerIds.length === 2) {
                const p2 = roster.find(r => r.id === selectedPlayerIds[1]);
                if (p1 && p2) {
                    // p1 is Setter, p2 is Attacker
                    return `Credit: #${p2.jerseyNumber} ${p2.name} (Set: #${p1.jerseyNumber})`;
                }
            }

            // Single player or last selected
            const lastId = selectedPlayerIds[selectedPlayerIds.length - 1];
            const p = roster.find(r => r.id === lastId);
            return p ? `Credit: #${p.jerseyNumber} ${p.name}` : `Credit: ${myTeamName}`;
        }

        return `Credit: ${myTeamName}`;
    };

    // Sub Picker State
    const [subPicker, setSubPicker] = useState<{ visible: boolean; position: number } | null>(null);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

    const handleSubClick = (player: Player, isLibero: boolean = false) => {
        if (subPicker) {
            substitute(subPicker.position, player, isLibero);
            haptics('selection');
            setSubPicker(null);
        }
    };

    // Auto-select Server (or clear on sideout)
    useEffect(() => {
        if (servingTeam === 'myTeam' && rallyState === 'pre-serve' && currentRotation) {
            // Find player in Position 1
            const server = currentRotation.find(p => p.position === 1);
            if (server && server.playerId) {
                setSelectedPlayerIds([server.playerId]);
            }
        } else if (servingTeam === 'opponent' && rallyState === 'pre-serve') {
            // Sideout: clear server highlight so P1 isn't stuck highlighted
            setSelectedPlayerIds([]);
        }
    }, [servingTeam, rallyState, currentRotation, history.length]);

    const handleScoreLongPress = (team: 'myTeam' | 'opponent') => {
        setOverrideModal({ visible: true, team });
    };

    const handleSaveScore = (newScore: number) => {
        if (overrideModal) {
            setScore(overrideModal.team, newScore);
            setOverrideModal(null);
        }
    };

    const handleToggleServe = () => {
        setServingTeam(servingTeam === 'myTeam' ? 'opponent' : 'myTeam');
    };

    // Logic for sets
    const isLastSet = currentSet === config.totalSets;
    const setConfig = config.sets[currentSet - 1] || config.sets[config.sets.length - 1];

    // Auto-Check Set Finished
    useEffect(() => {
        const { targetScore, winBy, cap } = setConfig;
        const myScore = currentScore.myTeam;
        const oppScore = currentScore.opponent;

        const isFinished = (myScore >= targetScore && myScore >= oppScore + winBy) ||
            (oppScore >= targetScore && oppScore >= myScore + winBy) ||
            (myScore === cap && myScore > oppScore) ||
            (oppScore === cap && oppScore > myScore);

        if (isFinished && !showEndOfSet) {
            setShowEndOfSet(true);
        }
    }, [currentScore, setConfig]);

    // @ts-ignore
    const handleStat = (type: StatLog['type'], team: 'myTeam' | 'opponent', label: string) => {
        let statsMetadata: any = {};
        let finalPlayerId: string | undefined = undefined;

        if (team === 'myTeam' && selectedPlayerIds.length > 0) {
            // Check for Kill, Error, Good Attack, or Block to track two-player attribution
            if ((type === 'kill' || type === 'attack_good' || type === 'attack_error' || type === 'block') && selectedPlayerIds.length === 2) {
                // Attack: first = setter (assist), second = attacker
                // Block: first = assist blocker, second = primary blocker
                statsMetadata.assistPlayerId = selectedPlayerIds[0];
                finalPlayerId = selectedPlayerIds[1];
            } else {
                // Default: Use last selected player (single selection)
                finalPlayerId = selectedPlayerIds[selectedPlayerIds.length - 1];
            }
        }

        recordStat(type, team, finalPlayerId, statsMetadata);

        if (finalPlayerId || selectedPlayerIds.length > 0) setSelectedPlayerIds([]);
    };

    // Selection Handler — context-aware constraints
    const handlePlayerSelect = (pid: string) => {
        // During Serve: P1 is auto-selected, lock selection
        if (canServe) return;

        // Toggle off if already selected
        if (selectedPlayerIds.includes(pid)) {
            setSelectedPlayerIds([]);
            return;
        }

        // During Receive: max 1 player (just replace selection)
        if (canReceive) {
            setSelectedPlayerIds([pid]);
            return;
        }

        // In Rally: allow up to 2 players (for Attack assist + hitter, or double Block)
        if (selectedPlayerIds.length === 0) {
            setSelectedPlayerIds([pid]);
        } else if (selectedPlayerIds.length === 1) {
            setSelectedPlayerIds([...selectedPlayerIds, pid]);
        } else {
            // Reset to new selection
            setSelectedPlayerIds([pid]);
        }
    };

    const handleNextSet = () => {
        // ... (Existing logic managed by store or EndOfSetModal mostly)
        setShowEndOfSet(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>VolleyTrack</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => setShowShare(true)} style={styles.menuBtn}>
                        <Radio size={22} color={isBroadcasting ? colors.success : colors.textSecondary} />
                        {isBroadcasting && viewerCount > 0 && (
                            <View style={[styles.viewerBadge, { backgroundColor: colors.success }]}>
                                <Eye size={8} color="#ffffff" />
                                <Text style={styles.viewerBadgeText}>{viewerCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.menuBtn}>
                        <Menu size={28} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Coach Alert Toast — non-modal, slides from top */}
            <CoachAlertToast
                alert={currentToastAlert}
                onDismiss={() => {
                    if (currentToastAlert) {
                        dismissAlert(currentToastAlert.id);
                    }
                    setCurrentToastAlert(null);
                }}
            />

            <View style={styles.content}>

                {/* Momentum Gauge + Timeout Banner (overlaid to prevent layout shift) */}
                <View style={styles.momentumContainer}>
                    {/* Timeout Recommendation — absolutely positioned overlay, no layout shift */}
                    {momentum.suggestion.shouldTimeout && (
                        <TouchableOpacity
                            style={[
                                styles.timeoutBanner,
                                { backgroundColor: momentum.suggestion.urgency === 'caution' ? colors.momentumCaution : colors.momentumUrgent }
                            ]}
                            onPress={() => {
                                const totalScore = currentScore.myTeam + currentScore.opponent;
                                Alert.alert(
                                    momentum.suggestion.urgency === 'urgent' ? 'Timeout Recommended' : 'Momentum Check',
                                    `${momentum.suggestion.reason}\n\nCall Timeout?`,
                                    [
                                        {
                                            text: 'Dismiss',
                                            style: 'cancel',
                                            onPress: () => setDismissedAtScore(totalScore)
                                        },
                                        { text: 'Call Timeout', onPress: () => useTimeout('myTeam') }
                                    ]
                                );
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <AlertCircle size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={[styles.timeoutBannerText, { color: '#ffffff' }]}>
                                    {momentum.suggestion.urgency === 'urgent' ? 'Consider TO' : 'Watch'} - {momentum.suggestion.reason}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    <View style={[styles.momentumBar, { backgroundColor: colors.momentumBase }]}>
                        {/* Center Marker */}
                        <View style={{ position: 'absolute', left: '50%', width: 2, height: '100%', backgroundColor: colors.bgCard, zIndex: 10 }} />

                        {/* Momentum Fill — minimum 4% width so even small shifts are visible */}
                        {momentum.score !== 0 && (
                            <View style={{
                                position: 'absolute',
                                height: '100%',
                                left: momentum.score > 0 ? '50%' : undefined,
                                right: momentum.score < 0 ? '50%' : undefined,
                                width: `${Math.max(4, Math.abs(momentum.score) / 2)}%`,
                                backgroundColor: momentum.score > 0 ? colors.momentumPositive : colors.momentumNegative,
                                borderRadius: 4,
                            }} />
                        )}
                    </View>
                    <View style={styles.momentumLabels}>
                        <Text style={[styles.momentumText, { color: colors.textTertiary }, momentum.score < -10 && { fontWeight: 'bold', color: colors.momentumNegative }]}>
                            {momentum.score < -10 ? 'Them' : ''}
                        </Text>
                        <Text style={[styles.momentumText, { color: colors.textTertiary }, momentum.score > 10 && { fontWeight: 'bold', color: colors.momentumPositive }]}>
                            {momentum.score > 10 ? 'Us' : ''}
                        </Text>
                    </View>
                </View>

                <ScoreBoard
                    myTeamName={myTeamName}
                    opponentName={opponentName}
                    currentSet={currentSet}
                    score={currentScore}
                    setsWon={setsWon}
                    setConfig={setConfig}
                    config={config}
                    setHistory={setHistory}
                    onScoreLongPress={handleScoreLongPress}
                    servingTeam={servingTeam}
                    onToggleServe={handleToggleServe}
                    timeoutsRemaining={timeoutsRemaining}
                    onUseTimeout={useTimeout}
                    configTimeouts={config.timeoutsPerSet || 2}
                    onIncrement={(team) => { incrementScore(team); haptics('medium'); }}
                    onDecrement={(team) => { decrementScore(team); haptics('light'); }}
                />

                {/* Lineup Tracker */}
                <LineupTracker
                    rotation={currentRotation || []}
                    roster={roster}
                    // @ts-ignore
                    selectedPlayerIds={selectedPlayerIds}
                    onSelectPlayer={handlePlayerSelect}
                    onSubstitute={(pos) => setSubPicker({ visible: true, position: pos })}
                    highlightPosition={(() => {
                        if (!history || history.length === 0) return null;

                        // Check last few events
                        const recentEvents = history.slice(-10).reverse();
                        const autoSwapEvent = recentEvents.find(e => e.type === 'substitution' && e.metadata?.autoSwap);
                        const rotationEvent = recentEvents.find(e => e.type === 'rotation');

                        if (autoSwapEvent && autoSwapEvent.metadata) {
                            // If we have rotated SINCE the swap, stop highlighting to prevent "following" the player
                            if (rotationEvent && rotationEvent.timestamp > autoSwapEvent.timestamp) {
                                return null;
                            }

                            const subInId = autoSwapEvent.metadata.subIn;
                            const slot = currentRotation?.find(p => p.playerId === subInId);
                            // Only highlight if they are still in the position we expect? 
                            // Actually, just returning the current position is fine IF we are sure no rotation happened.
                            // If no rotation happened, they are at the swap position.
                            return slot ? slot.position : null;
                        }
                        return null;
                    })()}
                />

                {/* Subs & Rotation Control Row */}
                <View style={styles.subsRow}>
                    <View style={styles.subsContainer}>
                        <Text style={[styles.subsLabel, { color: colors.textSecondary }]}>Subs</Text>
                        <View style={styles.subsDots}>
                            {[...Array(config.subsPerSet || 12)].map((_, i) => {
                                const isAvailable = i < subsRemaining.myTeam;
                                return (
                                    <View
                                        key={i}
                                        style={[styles.subDot, { backgroundColor: isAvailable ? colors.primary : colors.momentumBase }]}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={[styles.rotateInlineControls, { backgroundColor: colors.primaryLight }]}>
                        {/* Rotate Back */}
                        <TouchableOpacity style={styles.rotateInlineBtn} onPress={() => rotate('backward')}>
                            <RotateCcw size={18} color={colors.primary} />
                        </TouchableOpacity>

                        <Text style={[styles.rotateInlineLabel, { color: colors.primary }]}>Rotate</Text>

                        {/* Rotate Forward */}
                        <TouchableOpacity style={styles.rotateInlineBtn} onPress={() => rotate('forward')}>
                            <RotateCw size={18} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Modals */}
                <MatchSettingsModal
                    visible={showSettings}
                    onClose={() => setShowSettings(false)}
                    config={config}
                    onEndMatch={() => router.replace('/')}
                    onEndSet={isLastSet ? undefined : () => {
                        setShowSettings(false);
                        setShowEndOfSet(true);
                    }}
                    onViewStats={() => {
                        setShowSettings(false);
                        setShowStats(true);
                    }}
                />

                <ShareMatchModal
                    visible={showShare}
                    onClose={() => setShowShare(false)}
                    matchCode={liveMatchCode}
                    isBroadcasting={isBroadcasting}
                    isStarting={isStarting}
                    error={broadcastError}
                    onStartShare={startBroadcast}
                    onStopShare={stopBroadcast}
                />

                <StatsModal
                    visible={showStats}
                    onClose={() => setShowStats(false)}
                    logs={history}
                    roster={roster}
                />

                <FullLogModal
                    visible={showFullLog}
                    onClose={() => setShowFullLog(false)}
                    history={history}
                    roster={roster}
                />

                <ServeChoiceModal
                    visible={showServeChoice}
                    myTeamName={myTeamName}
                    opponentName={opponentName}
                    currentSet={currentSet}
                    totalSets={config.totalSets}
                    suggestedServer={getSuggestedServer()}
                    onChoose={handleServeChoice}
                />

                <EndOfSetModal
                    visible={showEndOfSet}
                    setNumber={currentSet}
                    score={currentScore}
                    myTeamName={myTeamName}
                    opponentName={opponentName}
                    setsWon={setsWon}
                    totalSets={config.totalSets}
                    onCorrectScore={() => setShowEndOfSet(false)}
                    onNextSet={() => {
                        setShowEndOfSet(false);
                        // setNonLiberoDesignations(new Set()); // Handled by Store now

                        // Check if match is actually finished (including the set just played)
                        const myScore = currentScore.myTeam;
                        const oppScore = currentScore.opponent;
                        const iWonSet = myScore > oppScore;

                        const myTotalWins = setsWon.myTeam + (iWonSet ? 1 : 0);
                        const oppTotalWins = setsWon.opponent + (!iWonSet ? 1 : 0);
                        const setsToWin = Math.ceil(config.totalSets / 2);
                        const isMatchDecided = myTotalWins >= setsToWin || oppTotalWins >= setsToWin;

                        if (isMatchDecided || currentSet >= config.totalSets) {
                            finalizeBroadcast(); // Stop live broadcast if active
                            finalizeMatch();
                            router.replace('/summary');
                        } else {
                            startNextSet();
                        }
                    }}
                />

                {overrideModal && (
                    <ScoreEditModal
                        visible={overrideModal.visible}
                        teamName={overrideModal.team === 'myTeam' ? myTeamName : opponentName}
                        currentScore={overrideModal.team === 'myTeam' ? currentScore.myTeam : currentScore.opponent}
                        onClose={() => setOverrideModal(null)}
                        onSave={handleSaveScore}
                    />
                )}

                {statPicker && (
                    <StatPickerModal
                        visible={statPicker.visible}
                        title={statPicker.title}
                        options={statPicker.options}
                        onSelect={(value) => {
                            if (statPicker.team) {
                                // @ts-ignore - Value is string but we know it matches StatLog['type']
                                handleStat(value, statPicker.team, 'Stat');
                                haptics('selection'); // Or heavy/success depending on stat?
                                // Let's simplify: selection for menu pick
                            }
                            setStatPicker(null);
                        }}
                        onClose={() => setStatPicker(null)}
                    />
                )}

                {/* Sub Picker Modal */}
                <Modal visible={!!subPicker} animationType="slide" presentationStyle="pageSheet">
                    <SubstituteModalContent
                        subPicker={subPicker}
                        roster={roster}
                        currentRotation={currentRotation}
                        subPairs={subPairs}
                        liberoIds={useMatchStore.getState().liberoIds} // Access latest store state
                        nonLiberoDesignations={nonLiberoDesignations || []}
                        onClose={() => setSubPicker(null)}
                        onSub={handleSubClick}
                        onDesignateNonLibero={designateNonLibero}
                    />
                </Modal>

                {/* Stat Grid — only the active row renders to save vertical space */}
                <View style={styles.statGrid}>
                    {isPreServe ? (
                        /* Pre-Serve: Serve & Receive */
                        <View style={styles.statRow}>
                            <StatButton
                                label="Serve"
                                color={canServe ? "#4a90e2" : colors.buttonDisabled}
                                disabled={!canServe}
                                onPress={() => {
                                    setStatPicker({
                                        visible: true,
                                        title: 'Serve Result',
                                        team: 'myTeam',
                                        attribution: getAttribution('serve'),
                                        options: [
                                            { label: 'Ace', subLabel: 'Point', value: 'ace', color: '#2196f3' },
                                            { label: 'Good', subLabel: 'In Play', value: 'serve_good', color: '#4caf50' },
                                            { label: 'Error', subLabel: 'Net/Out', value: 'serve_error', color: '#f44336' },
                                        ]
                                    });
                                    haptics('light');
                                }}
                                onLongPress={() => { handleStat('serve_error', 'myTeam', 'Serve Error'); haptics('error'); }}
                            />
                            <StatButton
                                label="Receive"
                                color={canReceive ? "#f5a623" : colors.buttonDisabled}
                                disabled={!canReceive}
                                onPress={() => {
                                    setStatPicker({
                                        visible: true,
                                        title: 'Receive Quality',
                                        team: 'myTeam',
                                        attribution: getAttribution('general'),
                                        options: [
                                            { label: '3', subLabel: 'Perfect', value: 'receive_3', color: '#4caf50' },
                                            { label: '2', subLabel: 'Good', value: 'receive_2', color: '#8bc34a' },
                                            { label: '1', subLabel: 'Poor', value: 'receive_1', color: '#ffc107' },
                                            { label: 'Error (No Point)', subLabel: 'Play Continues', value: 'receive_error', color: '#e91e63' },
                                            { label: 'Error (Point)', subLabel: 'Ends Rally', value: 'receive_0', color: '#f44336' },
                                        ]
                                    });
                                    haptics('light');
                                }}
                                onLongPress={() => { handleStat('receive_0', 'myTeam', 'Receive Error'); haptics('error'); }}
                            />
                        </View>
                    ) : (
                        /* In-Rally: Attack, Block, Dig, Error */
                        <View style={styles.statRow}>
                            <View style={styles.statRowSplit}>
                                <StatButton
                                    label="Attack"
                                    color={inRally ? "#50c878" : colors.buttonDisabled}
                                    disabled={!inRally}
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                        setStatPicker({
                                            visible: true,
                                            title: 'Attack Result',
                                            team: 'myTeam',
                                            attribution: getAttribution('attack'),
                                            options: [
                                                { label: 'Kill', subLabel: 'Point', value: 'kill', color: '#4caf50' },
                                                { label: 'Good', subLabel: 'In Play', value: 'attack_good', color: '#8bc34a' },
                                                { label: 'Error', subLabel: 'Net/Out', value: 'attack_error', color: '#f44336' },
                                            ]
                                        });
                                        haptics('light');
                                    }}
                                    onLongPress={() => { handleStat('attack_error', 'myTeam', 'Attack Error'); haptics('error'); }}
                                />
                                <StatButton
                                    label="Block"
                                    color={inRally ? "#009688" : colors.buttonDisabled}
                                    disabled={!inRally}
                                    style={{ flex: 1 }}
                                    onPress={() => { handleStat('block', 'myTeam', 'Block'); haptics('success'); }}
                                />
                            </View>
                            <View style={styles.statRowSplit}>
                                <StatButton
                                    label="Dig"
                                    color={inRally ? "#bd10e0" : colors.buttonDisabled}
                                    disabled={!inRally}
                                    style={{ flex: 1 }}
                                    onPress={() => { handleStat('dig', 'myTeam', 'Dig'); haptics('light'); }}
                                />
                                <StatButton
                                    label="Error"
                                    color={inRally ? "#9013fe" : colors.buttonDisabled}
                                    disabled={!inRally}
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                        setStatPicker({
                                            visible: true,
                                            title: 'Error Type',
                                            team: 'myTeam',
                                            attribution: getAttribution('general'),
                                            descriptor: 'These errors result in a point for the opponent.',
                                            options: [
                                                { label: 'Drop', subLabel: 'Ball fell', value: 'drop', color: '#f44336' },
                                                { label: 'Passing Error', subLabel: 'Shank/Double/Etc', value: 'pass_error', color: '#e91e63' },
                                                { label: 'Setting Error', subLabel: 'Shank/Net/Etc', value: 'set_error', color: '#9c27b0' },
                                            ]
                                        });
                                        haptics('light');
                                    }}
                                />
                            </View>
                        </View>
                    )}
                </View>

                {/* Log Area & Undo */}
                <View style={[styles.logContainer, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
                    <TouchableOpacity onPress={() => { undo(); haptics('medium'); }} disabled={history.length === 0} style={[styles.undoBtn, { backgroundColor: colors.bg }]}>
                        <Undo2 size={20} color={colors.textSecondary} />
                        <Text style={[styles.undoText, { color: colors.textSecondary }]}>Undo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowFullLog(true)} style={styles.expandLogBtn}>
                        <Maximize2 size={16} color={colors.textTertiary} />
                    </TouchableOpacity>

                    <View style={[styles.logContent, { flex: 1 }]}>
                        {currentRally && currentRally.length > 0 ? (
                            <View>
                                {(() => {
                                    const elements = [];
                                    let rallyBuffer: React.ReactNode[] = [];

                                    const flushBuffer = (keyPrefix: string) => {
                                        if (rallyBuffer.length > 0) {
                                            // Check if this buffer ends with a point result
                                            const lastItemIndex = elements.length + rallyBuffer.length;
                                            // Actually logic is simpler: Point result only applies to the VERY LAST item in the rally.
                                            // If we are flushing mid-rally (due to a sub), it's not a point yet usually.

                                            elements.push(
                                                <Text key={keyPrefix} style={[styles.logText, { marginBottom: 4, color: colors.textSecondary }]}>
                                                    {rallyBuffer}
                                                </Text>
                                            );
                                            rallyBuffer = [];
                                        }
                                    };

                                    currentRally.forEach((item, idx) => {
                                        // Admin Events
                                        if (item.type === 'substitution' || item.type === 'rotation' || item.type === 'timeout') {
                                            flushBuffer(`rally-${idx}`);

                                            // Render Admin Line
                                            // Render Admin Line
                                            if (item.type === 'substitution' && item.metadata) {
                                                const { subIn, subOut, autoSwap, notes } = item.metadata;

                                                if (notes) {
                                                    const isAssignment = item.metadata?.isAssignment;
                                                    elements.push(
                                                        <Text key={item.id} style={{ color: isAssignment ? colors.textSecondary : colors.error, fontStyle: 'italic', marginBottom: 4, fontSize: 13, fontWeight: isAssignment ? '500' : 'bold' }}>
                                                            {notes}
                                                        </Text>
                                                    );
                                                } else if (subOut) { // subOut is strictly required, subIn might be undefined in error cases
                                                    const pOut = roster.find(r => r.id === subOut);
                                                    const nameOut = pOut ? `#${pOut.jerseyNumber} ${pOut.name}` : `Unknown (#${String(subOut).substring(0, 4)})`;

                                                    let nameIn = '???';
                                                    if (subIn) {
                                                        const pIn = roster.find(r => r.id === subIn);
                                                        nameIn = pIn ? `#${pIn.jerseyNumber} ${pIn.name}` : `Unknown (#${String(subIn).substring(0, 4)})`;
                                                    }

                                                    elements.push(
                                                        <Text key={item.id} style={{ color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4, fontSize: 13 }}>
                                                            SUBSTITUTION: {nameIn} for {nameOut}
                                                            {autoSwap ? ' (Auto)' : ''}
                                                        </Text>
                                                    );
                                                }
                                            } else if (item.type === 'rotation') {
                                                elements.push(
                                                    <Text key={item.id} style={{ color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4, fontSize: 13 }}>
                                                        ROTATION
                                                    </Text>
                                                );
                                            }
                                            return;
                                        }

                                        // Rally Events
                                        const typeLabel = item.type.replace('_', ' ').toUpperCase();
                                        const isMyTeam = item.team === 'myTeam';
                                        let playerLabel = '';
                                        if (item.playerId) {
                                            const p = roster.find(r => r.id === item.playerId);
                                            if (p) playerLabel = ` (#${p.jerseyNumber})`;
                                        }

                                        // Assist Label
                                        if (item.assistPlayerId) {
                                            const a = roster.find(r => r.id === item.assistPlayerId);
                                            // Label as Assist for Kill, Set for others
                                            const label = item.type === 'kill' ? 'Asst' : 'Set';
                                            if (a) playerLabel += ` [${label}: #${a.jerseyNumber}]`;
                                        }

                                        if (rallyBuffer.length > 0) {
                                            rallyBuffer.push(<Text key={`sep-${item.id}`} style={{ color: colors.textTertiary }}> {' > '} </Text>);
                                        }

                                        rallyBuffer.push(
                                            <Text key={item.id} style={{ color: isMyTeam ? colors.primary : colors.opponent, fontWeight: 'bold' }}>
                                                {typeLabel}{playerLabel}
                                            </Text>
                                        );
                                    });

                                    // Final Flush
                                    if (rallyBuffer.length > 0) {
                                        // Append Result if applicable
                                        const lastItem = currentRally[currentRally.length - 1];
                                        const pointErrors = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'double', 'lift', 'net'];
                                        const pointScorers = ['kill', 'ace', 'block'];

                                        if ([...pointErrors, ...pointScorers].includes(lastItem.type)) {
                                            const isError = pointErrors.includes(lastItem.type);
                                            const perfTeam = lastItem.team;
                                            // If Error, point goes to OTHER team. If Scorer, point goes to PERF team.
                                            const winner = isError
                                                ? (perfTeam === 'myTeam' ? 'opponent' : 'myTeam')
                                                : perfTeam;

                                            rallyBuffer.push(
                                                <Text key="result" style={[styles.logScore, { color: colors.textSecondary }]}>
                                                    {' - POINT '}{winner === 'myTeam' ? 'MY TEAM' : 'OPPONENT'}
                                                </Text>
                                            );
                                        }
                                        elements.push(
                                            <Text key="final-rally" style={[styles.logText, { color: colors.textSecondary }]}>
                                                {rallyBuffer}
                                            </Text>
                                        );
                                    }

                                    return elements;
                                })()}
                            </View>
                        ) : (
                            <Text style={[styles.logPlaceholder, { color: colors.textTertiary }]}>Match started...</Text>
                        )}
                    </View>
                </View>

                {/* Ad Banner */}
                <AdBanner style={{ marginTop: 4 }} />

            </View >
        </SafeAreaView >
    );
}

// Sub-components to keep file clean
function StatButton({ label, subLabel, color, onPress, onLongPress, style, disabled }: any) {
    const isPad = (Platform as any).isPad;

    return (
        <TouchableOpacity
            style={[
                styles.statButton,
                { backgroundColor: color, opacity: disabled ? 0.4 : 1 },
                isPad && { minHeight: 120, padding: 16 }, // iPad Scaling
                style
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            disabled={disabled}
            delayLongPress={400}
        >
            <Text style={[styles.statLabel, isPad && { fontSize: 24, marginBottom: 8 }]}>{label}</Text>
            {subLabel && <Text style={[styles.statSub, isPad && { fontSize: 16 }]}>{subLabel}</Text>}
        </TouchableOpacity>
    );
}



const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    menuBtn: {
        padding: 4,
        position: 'relative',
    },
    viewerBadge: {
        position: 'absolute',
        top: -4,
        right: -8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 8,
        minWidth: 20,
        justifyContent: 'center',
    },
    viewerBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '800',
    },
    content: {
        padding: 16,
        flex: 1,
    },
    // Momentum & Alerts
    timeoutBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    timeoutBannerText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    momentumContainer: {
        marginBottom: 16,
        justifyContent: 'center',
        position: 'relative',
    },
    momentumBar: {
        height: 12,
        borderRadius: 6,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    momentumLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    momentumText: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scoreControls: {
        flexDirection: 'row',
        gap: 8, // Standardized Gap
        marginBottom: 24, // Increased vertical separation
    },
    scoreControlColumn: {
        flex: 1,
        gap: 8,
    },
    pointBtn: {
        width: '100%',
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    pointBtnMy: {
        backgroundColor: '#0066cc',
    },
    pointBtnOpp: {
        backgroundColor: '#cc0033',
    },
    pointBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    statGrid: {
        gap: 8,
        marginBottom: 8,
    },
    statRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statRowSplit: {
        flex: 1,
        flexDirection: 'row',
        minHeight: 75,
        gap: 8,
    },
    statButton: {
        flex: 1,
        padding: 8,
        borderRadius: 12,
        minHeight: 75,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statLabel: {
        color: '#fff',
        fontSize: 18, // Reduced from 22
        fontWeight: '800',
        marginBottom: 4,
        textAlign: 'center', // Ensure center
    },
    statSub: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '500',
    },
    // New Subs Styles
    // Subs Row
    subsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: -12, // Pull up closer to grid
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    subsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    subsLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    subsDots: {
        flexDirection: 'row',
        gap: 3,
    },
    subDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    rotateInlineControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    rotateInlineBtn: {
        padding: 2,
    },
    rotateInlineLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    // Log Area
    logContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginTop: 'auto',
        marginBottom: 8,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        gap: 12,
    },
    // (ad placeholder styles removed — now using AdBanner component)
    undoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    undoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    expandLogBtn: {
        padding: 4,
    },
    logContent: {
        flex: 1,
        justifyContent: 'center',
    },
    logText: {
        fontSize: 13,
        lineHeight: 18,
    },
    logLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 2,
    },
    logScore: {
        fontWeight: '600',
    },
    logPlaceholder: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    endSetBtn: {
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    endSetText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
