import { useEffect, useRef, useState } from 'react';
import { StatLog, Score, MatchConfig, Player, Team } from '../types';

// Stat types that end a rally and award a point
const POINT_SCORERS = ['ace', 'kill', 'block'];
const POINT_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'drop'];

function isRallyEnding(type: string): boolean {
    return POINT_SCORERS.includes(type) || POINT_ERRORS.includes(type);
}

/** Determine which team scored from a rally-ending event */
function getScoringTeam(event: StatLog): Team | null {
    if (!isRallyEnding(event.type)) return null;
    if (POINT_ERRORS.includes(event.type)) {
        return event.team === 'myTeam' ? 'opponent' : 'myTeam';
    }
    return event.team;
}

export type MomentumBannerType =
    | 'point_run'
    | 'set_point'
    | 'match_point'
    | 'set_won'
    | 'comeback'
    | 'timeout'
    | 'substitution'
    | 'side_out';

export interface MomentumEvent {
    id: string;
    type: MomentumBannerType;
    message: string;
    emoji: string;
    mood: 'positive' | 'neutral' | 'negative' | 'urgent';
    /** Whether to trigger emoji rain */
    triggerRain: boolean;
}

interface UseMomentumDetectionParams {
    history: StatLog[];
    currentSet: number;
    currentScore: Score;
    setsWon: Score;
    config: MatchConfig;
    myTeamName: string;
    opponentName: string;
    cheeringFor?: string[];
    myTeamRoster: Player[];
    servingTeam: Team;
    status: string;
}

/**
 * Detects momentum shifts and notable game moments, emitting banner events.
 *
 * Detects:
 * - Point runs (3+ consecutive by same team)
 * - Set point / match point
 * - Set won
 * - Comebacks (erasing 3+ point deficit to tie or lead)
 * - Timeouts
 * - Substitutions involving cheered-for players
 * - Side outs that break a 2+ point opponent run
 */
export function useMomentumDetection(params: UseMomentumDetectionParams) {
    const {
        history,
        currentSet,
        currentScore,
        setsWon,
        config,
        myTeamName,
        opponentName,
        cheeringFor,
        myTeamRoster,
        servingTeam,
        status,
    } = params;

    const [bannerQueue, setBannerQueue] = useState<MomentumEvent[]>([]);
    const [activeBanner, setActiveBanner] = useState<MomentumEvent | null>(null);

    const prevHistoryLenRef = useRef(0);
    const maxDeficitRef = useRef(0);
    const comebackTriggeredRef = useRef(false);
    const prevSetRef = useRef(currentSet);
    const eventIdRef = useRef(0);
    const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const nextId = () => {
        eventIdRef.current += 1;
        return `momentum-${eventIdRef.current}`;
    };

    /** Count consecutive points by same team from the tail of history in current set */
    function getPointStreak(hist: StatLog[], set: number): { team: Team; count: number } {
        const setEvents = hist.filter(e => e.setNumber === set && isRallyEnding(e.type));
        if (setEvents.length === 0) return { team: 'myTeam', count: 0 };

        let streakTeam: Team | null = null;
        let count = 0;

        for (let i = setEvents.length - 1; i >= 0; i--) {
            const scorer = getScoringTeam(setEvents[i]);
            if (!scorer) continue;
            if (streakTeam === null) {
                streakTeam = scorer;
                count = 1;
            } else if (scorer === streakTeam) {
                count++;
            } else {
                break;
            }
        }

        return { team: streakTeam || 'myTeam', count };
    }

    // Process new history events for momentum
    useEffect(() => {
        if (!history || history.length === 0) return;

        const histLen = history.length;
        if (histLen <= prevHistoryLenRef.current) {
            prevHistoryLenRef.current = histLen;
            return;
        }

        const newEvents = history.slice(prevHistoryLenRef.current);
        prevHistoryLenRef.current = histLen;

        const newBanners: MomentumEvent[] = [];

        for (const event of newEvents) {
            // Timeout detection
            if (event.type === 'timeout') {
                const teamName = event.team === 'myTeam' ? myTeamName : opponentName;
                newBanners.push({
                    id: nextId(),
                    type: 'timeout',
                    message: `TIMEOUT — ${teamName}`,
                    emoji: '⏰',
                    mood: 'neutral',
                    triggerRain: false,
                });
                continue;
            }

            // Substitution detection (only for cheered-for players)
            if (event.type === 'substitution' && cheeringFor && cheeringFor.length > 0) {
                const subIn = event.metadata?.subIn;
                const subOut = event.metadata?.subOut;
                const isRelevant =
                    (subIn && cheeringFor.includes(subIn)) ||
                    (subOut && cheeringFor.includes(subOut));

                if (isRelevant) {
                    const inName = event.metadata?.subInName || (subIn ? myTeamRoster.find(p => p.id === subIn)?.name : undefined);
                    const outName = event.metadata?.subOutName || (subOut ? myTeamRoster.find(p => p.id === subOut)?.name : undefined);
                    const inNum = event.metadata?.subInNumber;
                    const outNum = event.metadata?.subOutNumber;

                    let message = 'SUBSTITUTION';
                    if (inName && outName) {
                        message = `#${inNum || ''} ${inName} in for #${outNum || ''} ${outName}`;
                    } else if (inName) {
                        message = `#${inNum || ''} ${inName} entering the game`;
                    }

                    newBanners.push({
                        id: nextId(),
                        type: 'substitution',
                        message,
                        emoji: '🔀',
                        mood: 'neutral',
                        triggerRain: false,
                    });
                }
                continue;
            }

            // Rally-ending events — check for streaks, set point, etc.
            if (!isRallyEnding(event.type)) continue;

            const scorer = getScoringTeam(event);
            if (!scorer) continue;

            // Compute score after this event
            const scoreAfter: Score = {
                myTeam: event.scoreSnapshot.myTeam + (scorer === 'myTeam' ? 1 : 0),
                opponent: event.scoreSnapshot.opponent + (scorer === 'opponent' ? 1 : 0),
            };

            const setConf = config.sets[event.setNumber - 1] || { targetScore: 25, winBy: 2, cap: 100 };

            // -- Point Run Detection --
            const streak = getPointStreak(history, event.setNumber);
            if (streak.count >= 3) {
                const teamName = streak.team === 'myTeam' ? myTeamName : opponentName;
                const isMyTeam = streak.team === 'myTeam';
                newBanners.push({
                    id: nextId(),
                    type: 'point_run',
                    message: `${streak.count}-POINT RUN! ${teamName} on fire!`,
                    emoji: isMyTeam ? '🔥' : '⚡',
                    mood: isMyTeam ? 'positive' : 'negative',
                    triggerRain: isMyTeam && streak.count >= 5,
                });
            }

            // -- Side Out (break opponent run of 2+) --
            if (scorer === 'myTeam' && event.servingTeamSnapshot === 'opponent') {
                // Check if opponent had a 2+ run before this
                const prevStreak = getPointStreak(
                    history.slice(0, history.indexOf(event)),
                    event.setNumber
                );
                if (prevStreak.team === 'opponent' && prevStreak.count >= 2) {
                    newBanners.push({
                        id: nextId(),
                        type: 'side_out',
                        message: `SIDE OUT — Back to serve!`,
                        emoji: '🔄',
                        mood: 'positive',
                        triggerRain: false,
                    });
                }
            }

            // -- Comeback Detection --
            const deficit = scoreAfter.opponent - scoreAfter.myTeam;
            if (deficit > maxDeficitRef.current) {
                maxDeficitRef.current = deficit;
                comebackTriggeredRef.current = false;
            }
            if (
                maxDeficitRef.current >= 3 &&
                !comebackTriggeredRef.current &&
                scoreAfter.myTeam >= scoreAfter.opponent
            ) {
                comebackTriggeredRef.current = true;
                const msg = scoreAfter.myTeam === scoreAfter.opponent
                    ? `COMEBACK! ${myTeamName} tied it up ${scoreAfter.myTeam}-${scoreAfter.opponent}!`
                    : `COMEBACK! ${myTeamName} takes the lead ${scoreAfter.myTeam}-${scoreAfter.opponent}!`;
                newBanners.push({
                    id: nextId(),
                    type: 'comeback',
                    message: msg,
                    emoji: '💪',
                    mood: 'positive',
                    triggerRain: true,
                });
            }

            // -- Match Point Detection (check before set point) --
            const myTeamSetsNeeded = Math.ceil(config.totalSets / 2);
            const isDecidingSetForMyTeam = setsWon.myTeam === myTeamSetsNeeded - 1;
            const isDecidingSetForOpponent = setsWon.opponent === myTeamSetsNeeded - 1;

            const myTeamAtSetPoint =
                scoreAfter.myTeam >= setConf.targetScore - 1 &&
                scoreAfter.myTeam >= scoreAfter.opponent + (setConf.winBy - 1);
            const opponentAtSetPoint =
                scoreAfter.opponent >= setConf.targetScore - 1 &&
                scoreAfter.opponent >= scoreAfter.myTeam + (setConf.winBy - 1);

            if (myTeamAtSetPoint && isDecidingSetForMyTeam) {
                newBanners.push({
                    id: nextId(),
                    type: 'match_point',
                    message: `MATCH POINT — ${myTeamName} ${scoreAfter.myTeam}-${scoreAfter.opponent}`,
                    emoji: '😱',
                    mood: 'urgent',
                    triggerRain: false,
                });
            } else if (opponentAtSetPoint && isDecidingSetForOpponent) {
                newBanners.push({
                    id: nextId(),
                    type: 'match_point',
                    message: `MATCH POINT — ${opponentName} ${scoreAfter.opponent}-${scoreAfter.myTeam}`,
                    emoji: '😬',
                    mood: 'negative',
                    triggerRain: false,
                });
            } else if (myTeamAtSetPoint) {
                newBanners.push({
                    id: nextId(),
                    type: 'set_point',
                    message: `SET POINT — ${myTeamName} ${scoreAfter.myTeam}-${scoreAfter.opponent}`,
                    emoji: '⚡',
                    mood: 'positive',
                    triggerRain: false,
                });
            } else if (opponentAtSetPoint) {
                newBanners.push({
                    id: nextId(),
                    type: 'set_point',
                    message: `SET POINT — ${opponentName} ${scoreAfter.opponent}-${scoreAfter.myTeam}`,
                    emoji: '😬',
                    mood: 'negative',
                    triggerRain: false,
                });
            }
        }

        if (newBanners.length > 0) {
            setBannerQueue(prev => [...prev, ...newBanners]);
        }
    }, [history?.length, currentSet, config, myTeamName, opponentName, cheeringFor, myTeamRoster, setsWon]);

    // Set won detection (when set number advances)
    useEffect(() => {
        if (currentSet > prevSetRef.current) {
            const completedSet = prevSetRef.current;
            // Figure out who won the completed set
            const lastSetEvents = history.filter(e => e.setNumber === completedSet && isRallyEnding(e.type));
            if (lastSetEvents.length > 0) {
                const lastEvent = lastSetEvents[lastSetEvents.length - 1];
                const lastScorer = getScoringTeam(lastEvent);
                const finalScore: Score = {
                    myTeam: lastEvent.scoreSnapshot.myTeam + (lastScorer === 'myTeam' ? 1 : 0),
                    opponent: lastEvent.scoreSnapshot.opponent + (lastScorer === 'opponent' ? 1 : 0),
                };

                const myTeamWon = finalScore.myTeam > finalScore.opponent;
                const winnerName = myTeamWon ? myTeamName : opponentName;
                const winScore = myTeamWon ? finalScore.myTeam : finalScore.opponent;
                const loseScore = myTeamWon ? finalScore.opponent : finalScore.myTeam;

                setBannerQueue(prev => [...prev, {
                    id: nextId(),
                    type: 'set_won',
                    message: `SET WON! ${winnerName} takes Set ${completedSet}, ${winScore}-${loseScore}`,
                    emoji: '🏆',
                    mood: myTeamWon ? 'positive' : 'negative',
                    triggerRain: myTeamWon,
                }]);
            }

            // Reset comeback tracker for new set
            maxDeficitRef.current = 0;
            comebackTriggeredRef.current = false;
        }
        prevSetRef.current = currentSet;
    }, [currentSet, history, myTeamName, opponentName]);

    // Banner queue processor — show banners one at a time with 1.5s gap
    useEffect(() => {
        if (activeBanner || bannerQueue.length === 0) return;

        const [next, ...rest] = bannerQueue;
        setActiveBanner(next);
        setBannerQueue(rest);

        // Auto-dismiss after 4 seconds
        bannerTimerRef.current = setTimeout(() => {
            setActiveBanner(null);
        }, 4000);

        return () => {
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        };
    }, [bannerQueue, activeBanner]);

    const dismissBanner = () => {
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        setActiveBanner(null);
    };

    return {
        activeBanner,
        dismissBanner,
        /** Current point streak info */
        currentStreak: getPointStreak(history, currentSet),
    };
}
