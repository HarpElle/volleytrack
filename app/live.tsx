import { useRouter } from 'expo-router';
import { AlertCircle, Maximize2, Menu, RotateCcw, RotateCw, Undo2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EndOfSetModal from '../components/EndOfSetModal';
import FullLogModal from '../components/FullLogModal';
import LineupTracker from '../components/LineupTracker';
import MatchSettingsModal from '../components/MatchSettingsModal';
import ScoreBoard from '../components/ScoreBoard';
import ScoreEditModal from '../components/ScoreEditModal';
import StatPickerModal from '../components/StatPickerModal';
import StatsModal from '../components/StatsModal';
import { SubstituteModalContent } from '../components/SubstituteModalContent';
import { useHaptics } from '../hooks/useHaptic';
import { useDataStore } from '../store/useDataStore';
import { useMatchStore } from '../store/useMatchStore';
import { Player, StatLog } from '../types';
import { MomentumState, MomentumTracker } from '../utils/MomentumTracker';

export default function LiveScreen() {
    const router = useRouter();

    // Connect to store
    const {
        myTeamName, opponentName, currentSet, scores, setsWon,
        recordStat, incrementScore, decrementScore, setScore, undo,
        timeoutsRemaining, subsRemaining,
        useTimeout, useSub, startNextSet, finalizeMatch, config,
        history, setHistory, servingTeam, setServingTeam, rallyState,
        currentRotation, rotate, substitute, activeSeasonId,
        subPairs, nonLiberoDesignations, designateNonLibero,
    } = useMatchStore();

    // Get Roster
    const { seasons } = useDataStore();
    const activeSeason = seasons.find(s => s.id === activeSeasonId);
    const roster = activeSeason?.roster || [];
    const haptics = useHaptics();

    const currentScore = scores[currentSet - 1];

    // Hydration Guard: If store hasn't loaded scores yet, return null or loader
    if (!currentScore) {
        return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
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
    const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);

    useEffect(() => {
        if (!history || !currentScore) return;

        // Filter history for current set only to prevent bleed-over
        const currentSetHistory = history.filter(h => h.setNumber === currentSet);

        const result = MomentumTracker.analyze(currentSetHistory, currentScore, servingTeam);
        setMomentum(result);

        // Reset dismissal if suggestion clears or changes type
        if (!result.suggestion.shouldTimeout) {
            setDismissedSuggestion(null);
        }
    }, [history.length, currentScore, servingTeam]);

    // AUTO-SWAP LOGIC REMOVED (Handled in Store)
    const lastHistoryIdRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!history || history.length === 0) return;

        const latest = history[history.length - 1];

        // Skip if we've already processed this event
        if (lastHistoryIdRef.current === latest.id) return;
        lastHistoryIdRef.current = latest.id;

        // Check if it's an Auto-Swap
        // Note: Auto-swaps might be batched with rotation, so check the last few events if "Atomic" batching puts them not at the absolute end?
        // Actually, atomic update appends them in order. 
        // But if multiple events come in one render, we might want to scan the delta. 
        // For now, let's just check the last 3 events to be safe and ensure we don't alert twice for the same ID.

        const recentEvents = history.slice(-3);
        const autoSwapEvent = recentEvents.find(e =>
            e.type === 'substitution' &&
            e.metadata?.autoSwap === true &&
            e.id !== lastHistoryIdRef.current // Wait, ref tracks *latest* ID. This logic is tricky for batches.
        );

        // Simpler approach: Check if THE latest event, or one of the batch, is new.
        // We really just want to know if an auto-swap happened "just now".
        // The most robust way is to finding the *latest* auto-swap and seeing if it's newer than our last check? 
        // No, IDs aren't timestamps. 

        // Let's use the timestamp.
        const now = Date.now();
        const recentAutoSwap = history.find(e =>
            e.type === 'substitution' &&
            e.metadata?.autoSwap === true &&
            Math.abs(now - e.timestamp) < 1000 // Happened in last second
        );

        if (recentAutoSwap && recentAutoSwap.id !== lastHistoryIdRef.current) {
            // It's a fresh one (approx)
            // Actually, the ref should just store the ID of the last alerted auto-swap to be safe.
        }
    }, [history]);



    // Derived States
    // Serve enabled if: Pre-Serve AND My Serve
    const canServe = isPreServe && isMyServe;
    // Receive enabled if: Pre-Serve AND Opp Serve (Or if I want to log receive errors?)
    const canReceive = isPreServe && isOppServe;
    // Rally Actions enabled if: In Rally
    const inRally = isInRally;

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

    // Auto-select Server
    useEffect(() => {
        if (servingTeam === 'myTeam' && rallyState === 'pre-serve' && currentRotation) {
            // Find player in Position 1
            const server = currentRotation.find(p => p.position === 1);
            if (server && server.playerId) {
                setSelectedPlayerIds([server.playerId]);
            }
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
            // Check for Kill, Error, or Good Attack to track sets/assists
            if ((type === 'kill' || type === 'attack_good' || type === 'attack_error') && selectedPlayerIds.length === 2) {
                // Set/Assist Logic
                statsMetadata.assistPlayerId = selectedPlayerIds[0];
                finalPlayerId = selectedPlayerIds[1];
            } else {
                // Default: Use last selected player (e.g. Block, or just single selection)
                finalPlayerId = selectedPlayerIds[selectedPlayerIds.length - 1];
            }
        }

        recordStat(type, team, finalPlayerId, statsMetadata);

        if (finalPlayerId || selectedPlayerIds.length > 0) setSelectedPlayerIds([]);
    };

    // Selection Handler
    const handlePlayerSelect = (pid: string) => {
        if (selectedPlayerIds.includes(pid)) {
            // Deselect if already selected (simple toggle off)
            // Or if first is selected and we tap first again?
            setSelectedPlayerIds([]);
        } else {
            if (selectedPlayerIds.length === 0) {
                setSelectedPlayerIds([pid]);
            } else if (selectedPlayerIds.length === 1) {
                // Setter already selected, now Attacker
                setSelectedPlayerIds([...selectedPlayerIds, pid]);
            } else {
                // Reset to new selection
                setSelectedPlayerIds([pid]);
            }
        }
    };

    const handleNextSet = () => {
        // ... (Existing logic managed by store or EndOfSetModal mostly)
        setShowEndOfSet(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>VolleyTrack</Text>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.menuBtn}>
                    <Menu size={28} color="#333" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>

                {/* Timeout Recommendation */}
                {momentum.suggestion.shouldTimeout && momentum.suggestion.reason !== dismissedSuggestion && (
                    <TouchableOpacity
                        style={styles.timeoutBanner}
                        onPress={() => {
                            // If they tap it, assume they take it? Or just dismiss?
                            // Let's open the menu or just dismiss for now.
                            // Better: "Use Timeout?" prompt
                            Alert.alert('Coach Recommendation', `${momentum.suggestion.reason}\n\nCall Timeout?`, [
                                { text: 'No, Dismiss', style: 'cancel', onPress: () => setDismissedSuggestion(momentum.suggestion.reason || 'dismissed') },
                                { text: 'Call Timeout', onPress: () => useTimeout('myTeam') }
                            ]);
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AlertCircle size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.timeoutBannerText}>
                                Consider TO - {momentum.suggestion.reason}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Momentum Gauge (Simple Bar) */}
                <View style={styles.momentumContainer}>
                    <View style={[styles.momentumBar, {
                        // Map -100..100 to 0%..100% width, centered?
                        // Let's do a split bar. Center is 0.
                        // My Momentum (Right) vs Opponent (Left)?
                        // Simplified: Just a single colored bar indicating who has momentum
                        backgroundColor: '#eee',
                        overflow: 'hidden'
                    }]}>
                        {/* Center Marker */}
                        <View style={{ position: 'absolute', left: '50%', width: 2, height: '100%', backgroundColor: '#fff', zIndex: 10 }} />

                        {/* The Bar */}
                        <View style={{
                            position: 'absolute',
                            left: '50%',
                            height: '100%',
                            width: `${Math.abs(momentum.score) / 2}%`, // Max 50% width from center
                            backgroundColor: momentum.score > 0 ? '#4caf50' : '#f44336', // Green for me, Red for them
                            transform: [{ translateX: momentum.score > 0 ? 0 : -((Math.abs(momentum.score) / 2) / 100 * 300) }] // Re-positioning trick or just use marginLeft/Right?
                            // Easier: Use flexbox logic inside? 
                            // Let's try simple left/right positioning
                        }} />

                        <View style={{
                            position: 'absolute',
                            height: '100%',
                            // If score > 0, start at 50%, width = score/2 %
                            // If score < 0, right at 50%, width = abs(score)/2 %
                            left: momentum.score > 0 ? '50%' : undefined,
                            right: momentum.score < 0 ? '50%' : undefined,
                            width: `${Math.abs(momentum.score) / 2}%`,
                            backgroundColor: momentum.score > 0 ? '#4caf50' : '#f44336'
                        }} />
                    </View>
                    <View style={styles.momentumLabels}>
                        <Text style={[styles.momentumText, momentum.score < -20 && { fontWeight: 'bold', color: '#f44336' }]}>
                            {momentum.score < -20 ? 'Opponent Momentum' : ''}
                        </Text>
                        <Text style={[styles.momentumText, momentum.score > 20 && { fontWeight: 'bold', color: '#4caf50' }]}>
                            {momentum.score > 20 ? 'My Momentum' : ''}
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
                        <Text style={styles.subsLabel}>Subs</Text>
                        <View style={styles.subsDots}>
                            {[...Array(config.subsPerSet || 12)].map((_, i) => {
                                const isAvailable = i < subsRemaining.myTeam;
                                return (
                                    <View
                                        key={i}
                                        style={[styles.subDot, isAvailable ? styles.subDotAvailable : styles.subDotUsed]}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.rotateInlineControls}>
                        {/* Rotate Back */}
                        <TouchableOpacity style={styles.rotateInlineBtn} onPress={() => rotate('backward')}>
                            <RotateCcw size={18} color="#0066cc" />
                        </TouchableOpacity>

                        <Text style={styles.rotateInlineLabel}>Rotate</Text>

                        {/* Rotate Forward */}
                        <TouchableOpacity style={styles.rotateInlineBtn} onPress={() => rotate('forward')}>
                            <RotateCw size={18} color="#0066cc" />
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

                {/* Stat Grid */}
                <View style={styles.statGrid}>
                    <StatButton
                        label="Serve"
                        color={canServe ? "#4a90e2" : "#ccc"}
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
                        color={canReceive ? "#f5a623" : "#ccc"}
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

                    <View style={styles.statRowSplit}>
                        <StatButton
                            label="Attack"
                            color={inRally ? "#50c878" : "#ccc"}
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
                            color={inRally ? "#009688" : "#ccc"}
                            disabled={!inRally}
                            style={{ flex: 1 }}
                            onPress={() => { handleStat('block', 'myTeam', 'Block'); haptics('success'); }}
                        />
                    </View>
                    <View style={styles.statRowSplit}>
                        <StatButton
                            label="Dig"
                            color={inRally ? "#bd10e0" : "#ccc"}
                            disabled={!inRally}
                            style={{ flex: 1 }}
                            onPress={() => { handleStat('dig', 'myTeam', 'Dig'); haptics('light'); }}
                        />
                        <StatButton
                            label="Error"
                            color={inRally ? "#9013fe" : "#ccc"}
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

                {/* Log Area & Undo */}
                <View style={styles.logContainer}>
                    <TouchableOpacity onPress={() => { undo(); haptics('medium'); }} disabled={history.length === 0} style={styles.undoBtn}>
                        <Undo2 size={20} color="#666" />
                        <Text style={styles.undoText}>Undo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowFullLog(true)} style={styles.expandLogBtn}>
                        <Maximize2 size={16} color="#999" />
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
                                                <Text key={keyPrefix} style={[styles.logText, { marginBottom: 4 }]}>
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
                                                    elements.push(
                                                        <Text key={item.id} style={{ color: 'red', fontStyle: 'italic', marginBottom: 4, fontSize: 13, fontWeight: 'bold' }}>
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
                                                        <Text key={item.id} style={{ color: '#666', fontStyle: 'italic', marginBottom: 4, fontSize: 13 }}>
                                                            SUBSTITUTION: {nameIn} for {nameOut}
                                                            {autoSwap ? ' (Auto)' : ''}
                                                        </Text>
                                                    );
                                                }
                                            } else if (item.type === 'rotation') {
                                                elements.push(
                                                    <Text key={item.id} style={{ color: '#666', fontStyle: 'italic', marginBottom: 4, fontSize: 13 }}>
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
                                            rallyBuffer.push(<Text key={`sep-${item.id}`} style={{ color: '#ccc' }}> {' > '} </Text>);
                                        }

                                        rallyBuffer.push(
                                            <Text key={item.id} style={{ color: isMyTeam ? '#0066cc' : '#cc0033', fontWeight: 'bold' }}>
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
                                                <Text key="result" style={styles.logScore}>
                                                    {' - POINT '}{winner === 'myTeam' ? 'MY TEAM' : 'OPPONENT'}
                                                </Text>
                                            );
                                        }
                                        elements.push(
                                            <Text key="final-rally" style={styles.logText}>
                                                {rallyBuffer}
                                            </Text>
                                        );
                                    }

                                    return elements;
                                })()}
                            </View>
                        ) : (
                            <Text style={styles.logPlaceholder}>Match started...</Text>
                        )}
                    </View>
                </View>

                {/* Ad Placeholder */}
                <View style={styles.adContainer}>
                    <Text style={styles.adText}>Ad Banner Placeholder</Text>
                </View>

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
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#333',
        letterSpacing: -0.5,
    },
    menuBtn: {
        padding: 4,
    },
    content: {
        padding: 16,
        flex: 1,
    },
    // Momentum & Alerts
    timeoutBanner: {
        backgroundColor: '#ff9800',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12, // Gap below banner
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    timeoutBannerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    momentumContainer: {
        marginBottom: 16, // Gap below momentum bar
        justifyContent: 'center',
    },
    momentumBar: {
        height: 8,
        backgroundColor: '#e0e0e0', // Neutral grey base
        borderRadius: 4,
        width: '100%',
        position: 'relative',
        overflow: 'hidden', // Ensure bar doesn't overflow
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
        color: '#999',
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8, // Tighter gap
        marginBottom: 8, // Reduced margin
    },
    statRowSplit: {
        width: '48%',
        flexDirection: 'row',
        minHeight: 75,
        gap: 8, // Add gap to split rows
    },
    statButton: {
        width: '48%', // Approx half
        padding: 8, // Reduced padding
        borderRadius: 12,
        minHeight: 75,
        justifyContent: 'center',
        alignItems: 'center', // Center text
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
        color: '#666',
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
    subDotAvailable: {
        backgroundColor: '#0066cc',
    },
    subDotUsed: {
        backgroundColor: '#e0e0e0',
    },
    rotateInlineControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#e6f0ff',
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
        color: '#0066cc',
    },
    // Log Area
    logContainer: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginTop: 'auto', // Push to bottom if space allows
        marginBottom: 8, // Reduced margin
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 }, // Shadow up?
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        gap: 12,
    },
    // Ads
    adContainer: {
        height: 50,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed',
    },
    adText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
    },
    undoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    undoText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
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
        color: '#444',
        lineHeight: 18,
    },
    logLabel: {
        fontSize: 10,
        color: '#999',
        fontWeight: '700',
        marginBottom: 2,
    },
    logScore: {
        color: '#666',
        fontWeight: '600',
    },
    logPlaceholder: {
        fontSize: 13,
        color: '#999',
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
