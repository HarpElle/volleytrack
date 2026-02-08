import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AINarrative, LineupPosition, MatchConfig, MatchRecord, MatchState, Player, Score, SetResult, StatLog } from '../types';

/* 
  Mocking generateId for now to avoid extra files if not strictly needed yet.
*/
const getUniqueId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);
const lookupName = (id: string, roster: Player[]) => {
    const p = roster?.find(r => r.id === id);
    if (!p) return `#${id}`;
    return p.name ? `#${p.jerseyNumber} ${p.name}` : `#${p.jerseyNumber}`;
};

const INITIAL_SCORE: Score = { myTeam: 0, opponent: 0 };
// ... (rest of imports/setup)

export const useMatchStore = create<MatchState>()(
    persist(
        (set, get) => ({
            // Setup
            myTeamName: 'My Team',
            opponentName: 'Opponent',
            matchId: getUniqueId(),
            config: {
                presetName: '3-Set',
                totalSets: 3,
                sets: [
                    { targetScore: 25, winBy: 2, cap: 30 },
                    { targetScore: 25, winBy: 2, cap: 30 },
                    { targetScore: 15, winBy: 2, cap: 20 },
                ],
            },

            // Live State
            currentSet: 1,
            scores: [INITIAL_SCORE],
            setsWon: { myTeam: 0, opponent: 0 },
            history: [],
            setHistory: [],
            aiNarrative: undefined,

            // Rally Flow & Roster
            servingTeam: 'myTeam', // Default to My Team for now, allows override
            rallyState: 'pre-serve',
            myTeamRoster: [],
            opponentTeamRoster: [],

            // Resources
            timeoutsRemaining: { myTeam: 2, opponent: 2 },
            subsRemaining: { myTeam: 6, opponent: 6 },

            lineups: {},
            currentRotation: [],



            setServingTeam: (team) => {
                set({ servingTeam: team });
            },

            startRally: () => {
                set({ rallyState: 'in-rally' });
            },

            endRally: (winner) => {
                const { servingTeam, rallyState } = get();

                // Logic: 
                // 1. Increment Score for winner
                // 2. Logic for Sideout vs Point
                // 3. Reset Rally State

                // We use incrementScore logic but centralized here?
                // Or just call incrementScore helper? 
                // Let's copy the core score logic to ensure atomic update with rally state.

                const { scores, currentSet, history } = get();
                const currentScore = scores[currentSet - 1] || INITIAL_SCORE;

                // Determine next server
                let nextServingTeam = servingTeam;
                if (winner !== servingTeam) {
                    nextServingTeam = winner;
                    // Sideout logic
                    if (nextServingTeam === 'myTeam') {
                        // My team won the serve back -> Rotate
                        get().rotate('forward');
                    }
                }

                // Create Log
                const log: StatLog = {
                    id: getUniqueId(),
                    timestamp: Date.now(),
                    type: 'point_adjust', // Generic point if called directly? Or implied by stat?
                    team: winner,
                    scoreSnapshot: { ...currentScore }, // Snapshot BEFORE score change? Previous log was "after"? 
                    // Wait, previous code: type: 'point_adjust', scoreSnapshot: { ...currentScore } ... THEN score update ... 
                    // Actually previous code: scoreSnapshot: { ...currentScore } (this is PRE-inc). 
                    // Let's stick to consistent logging.
                    rallyStateSnapshot: rallyState,
                    servingTeamSnapshot: servingTeam,
                    rotationSnapshot: get().currentRotation,
                    setNumber: currentSet,
                };

                const newScore = { ...currentScore, [winner]: currentScore[winner] + 1 };
                const newScores = [...scores];
                newScores[currentSet - 1] = newScore;

                set({
                    scores: newScores,
                    history: [...history, log],
                    servingTeam: nextServingTeam,
                    rallyState: 'pre-serve'
                });
            },

            incrementScore: (team) => {
                // Now just a wrapper for 'endRally' effectively?
                // Or explicit Manual Override?
                // If Manual +, we assume "They won the rally".
                get().endRally(team);
            },

            decrementScore: (team) => {
                const { scores, currentSet, history } = get();
                const currentScore = scores[currentSet - 1] || INITIAL_SCORE;
                if (currentScore[team] === 0) return; // Cannot go below 0

                const log: StatLog = {
                    id: getUniqueId(),
                    timestamp: Date.now(),
                    type: 'point_adjust',
                    team,
                    scoreSnapshot: { ...currentScore },
                    rallyStateSnapshot: get().rallyState,
                    servingTeamSnapshot: get().servingTeam,
                    rotationSnapshot: get().currentRotation,
                    setNumber: currentSet,
                };

                const newScore = { ...currentScore, [team]: currentScore[team] - 1 };
                const newScores = [...scores];
                newScores[currentSet - 1] = newScore;

                set({
                    scores: newScores,
                    history: [...history, log],
                });
            },

            setScore: (team, score) => {
                const { scores, currentSet, history, rallyState, servingTeam } = get();
                const currentScore = scores[currentSet - 1] || INITIAL_SCORE;

                const log: StatLog = {
                    id: getUniqueId(),
                    timestamp: Date.now(),
                    type: 'point_adjust',
                    team,
                    scoreSnapshot: { ...currentScore },
                    rallyStateSnapshot: rallyState,
                    servingTeamSnapshot: servingTeam,
                    rotationSnapshot: get().currentRotation,
                    setNumber: currentSet,
                };

                const newScore = { ...currentScore, [team]: score };
                const newScores = [...scores];
                newScores[currentSet - 1] = newScore;

                set({
                    scores: newScores,
                    history: [...history, log],
                });
            },

            setAINarrative: (narrative: AINarrative) => {
                set({ aiNarrative: narrative });
            },

            recordStat: (type: StatLog['type'], team: 'myTeam' | 'opponent', playerId?: string, metadata?: any) => {
                const { servingTeam, history, scores, currentSet, rallyState } = get();
                const currentScore = scores[currentSet - 1] || INITIAL_SCORE;

                // Determine if this stat affects score/rally
                let winner: MatchState['servingTeam'] | null = null;

                if (type === 'ace' || type === 'kill' || type === 'block') {
                    winner = team;
                } else if (
                    type === 'serve_error' ||
                    type === 'attack_error' ||
                    type === 'dig_error' ||
                    type === 'set_error' ||
                    type === 'pass_error' ||
                    type === 'drop' ||
                    type === 'receive_0'
                ) {
                    winner = team === 'myTeam' ? 'opponent' : 'myTeam';
                }

                // If terminal, call endRally logic BUT we need to preserve the specific STAT TYPE in history.
                // endRally logs 'point_adjust'. We want 'ace', etc.

                // Create log entry first
                const log: StatLog = {
                    id: getUniqueId(),
                    timestamp: Date.now(),
                    type,
                    team,
                    playerId,
                    assistPlayerId: metadata?.assistPlayerId,
                    metadata,
                    scoreSnapshot: { ...currentScore },
                    rallyStateSnapshot: rallyState, // Capture state BEFORE change
                    servingTeamSnapshot: servingTeam,
                    rotationSnapshot: get().currentRotation,
                    setNumber: currentSet,
                };

                if (winner) {
                    // Update scores
                    let newScore = { ...currentScore };
                    if (winner === 'myTeam') newScore.myTeam++;
                    else newScore.opponent++;

                    // Determine next server
                    let nextServingTeam = servingTeam;
                    if (winner !== servingTeam) {
                        nextServingTeam = winner;

                        // Auto-Rotate if My Team wins the serve (Side-out)
                        if (winner === 'myTeam') {
                            get().rotate('forward');
                        }
                    }

                    // Update state
                    set((state) => {
                        const newScores = [...state.scores];
                        if (newScores[currentSet - 1]) {
                            newScores[currentSet - 1] = newScore;
                        }

                        // Use state.history to ensure we don't overwrite rotation logs
                        return {
                            history: [...state.history, log],
                            scores: newScores,
                            servingTeam: nextServingTeam,
                            rallyState: 'pre-serve'
                        };
                    });
                } else {
                    // Non-terminal stat (Good dig, Good pass, or Non-Point Error)
                    let nextRallyState = get().rallyState;
                    if (type === 'serve_good' || type === 'receive_1' || type === 'receive_2' || type === 'receive_3' || type === 'receive_error') {
                        nextRallyState = 'in-rally';
                    }

                    set(state => ({
                        history: [...state.history, log],
                        rallyState: nextRallyState
                    }));
                }
            },

            undo: () => {
                const { history, scores, currentSet } = get();
                if (history.length === 0) return;

                const lastAction = history[history.length - 1];

                if (lastAction.setNumber === currentSet) {
                    const newScores = [...scores];
                    newScores[currentSet - 1] = lastAction.scoreSnapshot;

                    let newHistory = history.slice(0, -1);
                    const changes: Partial<MatchState> = {
                        scores: newScores,
                        history: newHistory,
                    };

                    // RESTORE RALLY STATE
                    if (lastAction.rallyStateSnapshot) {
                        changes.rallyState = lastAction.rallyStateSnapshot;
                    }
                    if (lastAction.servingTeamSnapshot) {
                        changes.servingTeam = lastAction.servingTeamSnapshot;
                    }

                    // Undo Substitution Logic
                    if (lastAction.type === 'substitution' && lastAction.metadata) {
                        const { subIn, subOut, subConsumed } = lastAction.metadata;
                        // Find current position of subIn
                        const currentRot = get().currentRotation || [];
                        const targetSlot = currentRot.find(p => p.playerId === subIn);

                        if (targetSlot) {
                            // Swap back: Put subOut ID into this slot
                            const restoredRotation = currentRot.map(p =>
                                p.position === targetSlot.position
                                    ? { ...p, playerId: subOut || null, isLibero: false }
                                    : p
                            );

                            changes.currentRotation = restoredRotation;

                            // Restore Sub Count
                            if (subConsumed) {
                                const team = lastAction.team; // 'myTeam' usually
                                const currentSubs = get().subsRemaining;
                                changes.subsRemaining = {
                                    ...currentSubs,
                                    [team]: currentSubs[team] + 1
                                };
                            }
                        }
                    }

                    set(changes);
                }
            },

            useTimeout: (team) => {
                const { timeoutsRemaining: remaining } = get();
                if (remaining[team] > 0) {
                    set(state => ({
                        timeoutsRemaining: {
                            ...state.timeoutsRemaining,
                            [team]: state.timeoutsRemaining[team] - 1
                        }
                    }));
                    get().recordStat('timeout', team);
                    // Also maybe pause rally logic? Usually automatic in real life.
                }
            },

            useSub: (team) => {
                set((state) => ({
                    subsRemaining: {
                        ...state.subsRemaining,
                        [team]: Math.max(0, state.subsRemaining[team] - 1)
                    }
                }));
            },

            startNextSet: () => {
                set((state) => {
                    // Calculate who won the previous set
                    const setIdx = state.currentSet - 1;
                    const score = state.scores[setIdx];
                    // Identify winner
                    const winner = score.myTeam > score.opponent ? 'myTeam' : 'opponent';

                    // Loser of previous set serves first in next set? Or standard rules?
                    // Standard: Loser serves first.
                    const nextServer = winner === 'myTeam' ? 'opponent' : 'myTeam';

                    return {
                        currentSet: state.currentSet + 1,
                        scores: [...state.scores, { myTeam: 0, opponent: 0 }],
                        setsWon: { ...state.setsWon, [winner]: state.setsWon[winner] + 1 },
                        setHistory: [...state.setHistory, { setNumber: state.currentSet, winner, score }],
                        servingTeam: nextServer,
                        rallyState: 'pre-serve',
                        timeoutsRemaining: {
                            myTeam: state.config.timeoutsPerSet ?? 2,
                            opponent: state.config.timeoutsPerSet ?? 2
                        },
                        subsRemaining: {
                            myTeam: state.config.subsPerSet ?? 15,
                            opponent: state.config.subsPerSet ?? 15
                        },
                        currentRotation: state.lineups?.[state.currentSet + 1] || state.lineups?.[state.currentSet] || [], // Initialize next set rotation (cascade if needed)
                        liberoIds: [],
                        subPairs: {}
                    };
                });
            },

            updateMatchSettings: (matchId: string, myTeam: string, opponent: string, config: MatchConfig, lineups?: Record<number, LineupPosition[]>) => {
                set(state => {
                    // Only update if matchId matches (sanity check)
                    if (state.matchId !== matchId) return {};

                    const currentLineups = state.lineups || {};
                    const updatedLineups = lineups ? { ...currentLineups, ...lineups } : currentLineups;

                    // Logic to update active currentRotation if we are editing the current set's lineup
                    // and it's safe to do so (no game actions yet, or currentRotation is broken/empty).
                    let newCurrentRotation = state.currentRotation;

                    if (state.currentSet && updatedLineups[state.currentSet]) {
                        // Check if current set has started (has history?)
                        const setHasHistory = state.history.some(h => h.setNumber === state.currentSet);
                        const rotationIsEmpty = (!state.currentRotation || state.currentRotation.length === 0);

                        // If no history OR rotation is missing, apply the update immediately
                        if (!setHasHistory || rotationIsEmpty) {
                            newCurrentRotation = updatedLineups[state.currentSet];
                        }
                    }

                    return {
                        myTeamName: myTeam,
                        opponentName: opponent,
                        config: config,
                        lineups: updatedLineups,
                        currentRotation: newCurrentRotation
                    };
                });
            },

            setSetup: (myTeam, opponent, config, seasonId, eventId, matchId, lineups, roster) => {
                set({
                    myTeamName: myTeam,
                    opponentName: opponent,
                    config,
                    matchId: matchId || getUniqueId(), // Use existing ID if provided (e.g. Scheduled Match)
                    activeSeasonId: seasonId,
                    activeEventId: eventId,
                    // Reset match state on new setup
                    currentSet: 1,
                    scores: [{ myTeam: 0, opponent: 0 }],
                    setsWon: { myTeam: 0, opponent: 0 },
                    history: [],
                    setHistory: [],
                    aiNarrative: undefined,
                    servingTeam: 'myTeam',
                    rallyState: 'pre-serve',
                    timeoutsRemaining: {
                        myTeam: config.timeoutsPerSet ?? 2,
                        opponent: config.timeoutsPerSet ?? 2
                    },
                    subsRemaining: {
                        myTeam: config.subsPerSet ?? 15,
                        opponent: config.subsPerSet ?? 15
                    },
                    lineups: lineups || {},
                    currentRotation: lineups?.[1] || [], // Initialize Set 1
                    liberoIds: [],
                    subPairs: {},
                    myTeamRoster: roster || []
                });
            },

            resetMatch: () => {
                set({
                    // Keep config and team names? User likely wants to clear the *match progress*.
                    // Or clear everything to "New Match" state?
                    // "Reset the Match" implies restarting the game.
                    // Let's reset scores, history, but KEEP config/team names so they can just restart.
                    currentSet: 1,
                    scores: [{ myTeam: 0, opponent: 0 }],
                    setsWon: { myTeam: 0, opponent: 0 },
                    history: [],
                    setHistory: [],
                    servingTeam: 'myTeam',
                    rallyState: 'pre-serve',
                    timeoutsRemaining: {
                        myTeam: get().config.timeoutsPerSet ?? 2,
                        opponent: get().config.timeoutsPerSet ?? 2
                    },
                    subsRemaining: {
                        myTeam: get().config.subsPerSet ?? 15,
                        opponent: get().config.subsPerSet ?? 15
                    },
                    // Reset substitution/lineup tracking for the live match
                    liberoIds: [],
                    subPairs: {},
                    // Keep lineups? Yes, probably want to keep the lineup they just set.
                    // Keep Roster? Yes.
                    aiNarrative: undefined,
                });
            },

            // ... (rest of store) ...

            finalizeMatch: () => {
                const state = get();

                // 1. Archive current set (local state update)
                const currentScore = state.scores[state.currentSet - 1];
                const iWon = currentScore.myTeam > currentScore.opponent;
                const winner = iWon ? 'myTeam' : 'opponent';

                const newHistoryItem: SetResult = {
                    setNumber: state.currentSet,
                    score: currentScore,
                    winner
                };

                const newSetsWon = { ...state.setsWon };
                newSetsWon[winner]++;

                const updatedSetHistory = [...state.setHistory, newHistoryItem];

                set((s) => ({
                    setHistory: updatedSetHistory,
                    setsWon: newSetsWon,
                    rallyState: 'pre-serve',
                }));

                // 2. Save to Persistent DataStore
                const { useDataStore } = require('./useDataStore'); // Deferred import to avoid cycle if any
                const dataStore = useDataStore.getState();
                const saveMatch = dataStore.saveMatchRecord;

                // Retrieve existing scheduled match to preserve metadata (time, court, etc.)
                const existingMatch = dataStore.savedMatches.find((m: MatchRecord) => m.id === state.matchId);

                // Determine Match Result
                const setsToWin = Math.ceil(state.config.totalSets / 2);
                const matchWon = newSetsWon.myTeam >= setsToWin;
                const matchLost = newSetsWon.opponent >= setsToWin;

                let result: 'Win' | 'Loss' | 'In Progress' = 'In Progress';
                if (matchWon) result = 'Win';
                if (matchLost) result = 'Loss';
                // If finalized early (e.g. 2-0), it counts as win/loss.

                saveMatch({
                    id: state.matchId,
                    seasonId: state.activeSeasonId,
                    eventId: state.activeEventId,
                    opponentName: state.opponentName,
                    date: existingMatch?.date || Date.now(), // Preserve scheduled date if exists
                    time: existingMatch?.time,             // Preserve scheduled time
                    courtNumber: existingMatch?.courtNumber, // Preserve court number
                    result,
                    setsWon: newSetsWon,
                    scores: state.scores,
                    history: state.history,
                    lineups: state.lineups,
                    // Preserve existing narrative if we aren't generating a new one right now? 
                    // Usually narrative is generated AFTER finalization. 
                    // But if we had one, keep it? 
                    // Actually state.aiNarrative is current live state, so use that.
                    aiNarrative: state.aiNarrative || existingMatch?.aiNarrative
                });
            },





            rotate: (direction = 'forward', roster?: Player[]) => {
                set(state => {
                    const current = state.currentRotation || [];
                    if (current.length === 0) return {};

                    // 1. Calculate New Positions
                    const newRotation = current.map(slot => {
                        let newPos = slot.position;
                        if (direction === 'forward') {
                            // 1->6, 6->5, 5->4, 4->3, 3->2, 2->1
                            if (slot.position === 1) newPos = 6;
                            else if (slot.position === 6) newPos = 5;
                            else if (slot.position === 5) newPos = 4;
                            else if (slot.position === 4) newPos = 3;
                            else if (slot.position === 3) newPos = 2;
                            else if (slot.position === 2) newPos = 1;
                        } else {
                            if (slot.position === 6) newPos = 1;
                            else if (slot.position === 5) newPos = 6;
                            else if (slot.position === 4) newPos = 5;
                            else if (slot.position === 3) newPos = 4;
                            else if (slot.position === 2) newPos = 3;
                            else if (slot.position === 1) newPos = 2;
                        }
                        return { ...slot, position: newPos as any };
                    });

                    // 2. Prepare Logs
                    const currentSetIdx = state.currentSet - 1;
                    const scoreSnapshot = state.scores[currentSetIdx] || { myTeam: 0, opponent: 0 };
                    const now = Date.now();

                    const rotLog: StatLog = {
                        id: getUniqueId(),
                        timestamp: now,
                        type: 'rotation',
                        team: state.servingTeam,
                        scoreSnapshot: { ...scoreSnapshot },
                        setNumber: state.currentSet,
                        rotationSnapshot: state.currentRotation // Snapshot BEFORE rotation change? Or after?
                        // Rotation logs mark the ACTION of rotating. 
                        // Usually we want to know what the rotation WAS before it changed, OR what it became.
                        // Let's store the BEFORE state (current) consistent with other snapshots.
                    };

                    const autoSwapLogs: StatLog[] = [];

                    // 3. Identify Auto-Swaps
                    const finalRotation = newRotation.map(slot => {
                        const isFrontRow = [4, 3, 2].includes(slot.position);
                        // Check strict Libero status
                        const isLibero = state.liberoIds?.includes(slot.playerId!) || slot.isLibero;

                        if (isFrontRow && isLibero) {
                            const partnerId = state.subPairs?.[slot.playerId!];
                            if (partnerId) {
                                // Find names for Alert (Robust Fallback)
                                const activeRoster = (roster && roster.length > 0) ? roster : (state.myTeamRoster || []);
                                const subOutName = lookupName(slot.playerId!, activeRoster);
                                const subInName = lookupName(partnerId, activeRoster);

                                // Alert & Haptics
                                try {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    // Alert removed per user feedback (Pulse only)
                                } catch (e) {
                                    // Haptic error ignored
                                }

                                // Auto-Swap Success
                                autoSwapLogs.push({
                                    id: getUniqueId() + '_auto_' + slot.playerId,
                                    timestamp: now + 1, // +1ms to ensure order after rotation
                                    type: 'substitution',
                                    team: 'myTeam',
                                    scoreSnapshot: { ...scoreSnapshot },
                                    setNumber: state.currentSet,
                                    metadata: {
                                        subIn: partnerId,
                                        subOut: slot.playerId!,
                                        subConsumed: false,
                                        autoSwap: true
                                    }
                                });
                                return { ...slot, playerId: partnerId, isLibero: false };
                            }
                        }
                        return slot;
                    });

                    // 4. Atomic Update
                    const finalHistory = [...state.history, rotLog, ...autoSwapLogs];



                    return {
                        currentRotation: finalRotation,
                        history: finalHistory
                    };
                });
            },

            getRotationStats: () => {
                // Placeholder - implementation is in StatsEngine utility
                return;
            },

            substitute: (position, player, isLibero = false) => {
                set(state => {
                    const current = state.currentRotation || [];
                    const idx = current.findIndex(p => p.position === position);
                    if (idx === -1) return {};

                    const newRotation = [...current];
                    const playerOutId = newRotation[idx].playerId;

                    // Substitution on the rotation grid implies My Team
                    const isMyTeam = true;

                    // Libero Logic
                    // Check if player is ALREADY a known Libero for this set
                    const knownLiberos = state.liberoIds || [];
                    const isKnownLibero = knownLiberos.includes(player.id);

                    const isLiberoSwap = isLibero || isKnownLibero || (player.positions && player.positions.includes('L'));

                    // Update Libero IDs list if new
                    let newLiberoIds = [...knownLiberos];
                    if (isLiberoSwap && !isKnownLibero) {
                        newLiberoIds.push(player.id);
                    }

                    newRotation[idx] = {
                        ...newRotation[idx],
                        playerId: player.id,
                        isLibero: isLiberoSwap
                    };

                    // Smart Sub Pairs Logic
                    let newSubPairs = { ...state.subPairs };
                    if (playerOutId) {
                        // Link Out -> In and In -> Out
                        newSubPairs[playerOutId] = player.id;
                        newSubPairs[player.id] = playerOutId;
                    }

                    // Decrement sub count unless Libero OR if filling empty slot (no playerOutId)
                    let newSubsRemaining = { ...state.subsRemaining };
                    if (!isLiberoSwap && playerOutId) {
                        const teamKey = isMyTeam ? 'myTeam' : 'opponent';
                        newSubsRemaining[teamKey] = Math.max(0, newSubsRemaining[teamKey] - 1);
                    }

                    // Log the substitution details
                    const subMetadata = {
                        subIn: player.id,
                        subOut: playerOutId,
                        subConsumed: (!isLiberoSwap && !!playerOutId && playerOutId !== player.id)
                    };
                    get().recordStat('substitution', isMyTeam ? 'myTeam' : 'opponent', undefined, subMetadata);

                    return {
                        currentRotation: newRotation,
                        liberoIds: newLiberoIds,
                        subPairs: newSubPairs,
                        subsRemaining: newSubsRemaining
                    };
                });
            },

            updateLogEntry: (logId, updates) => {
                set(state => ({
                    history: state.history.map(log => log.id === logId ? { ...log, ...updates } : log)
                }));
            }
        }),
        {
            name: 'match-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
