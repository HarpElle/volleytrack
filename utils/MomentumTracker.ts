import { Score, StatLog } from '../types';

export type SuggestionUrgency = 'caution' | 'urgent';

export interface MomentumState {
    score: number; // -100 (Bad) to 100 (Good)
    trend: 'rising' | 'falling' | 'stable';
    suggestion: {
        shouldTimeout: boolean;
        urgency?: SuggestionUrgency;
        reason?: string;
    };
}

// Terminal stat types that result in a point (via specific stat logging)
const POINT_WINNERS = ['ace', 'kill', 'block'];
const POINT_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'];
const ALL_TERMINAL = [...POINT_WINNERS, ...POINT_ERRORS];

// My-team error types (for error chain detection)
const MY_TEAM_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error', 'pass_error', 'drop'];

/**
 * Determines the point winner for a scoring event.
 *
 * Handles both specific stat types (ace, kill, etc.) AND direct score taps
 * which are logged as 'point_adjust'. This is critical because tapping
 * the opponent's score is the primary way opponent points get recorded.
 */
function getPointWinner(log: StatLog): 'myTeam' | 'opponent' | null {
    // Direct score tap / manual adjustment — the team field IS the winner
    if (log.type === 'point_adjust') return log.team;

    if (!ALL_TERMINAL.includes(log.type)) return null;
    if (POINT_WINNERS.includes(log.type)) return log.team;
    // Errors give point to the other team
    return log.team === 'myTeam' ? 'opponent' : 'myTeam';
}

export class MomentumTracker {

    // --- Sensitivity Config ---
    // Raised from original values to reduce premature suggestions
    private static RUN_THRESHOLD_CAUTION = 3;  // Subtle indicator (tint bar)
    private static RUN_THRESHOLD_URGENT = 4;   // Show timeout banner
    private static ERROR_CHAIN_THRESHOLD = 3;  // Consecutive unforced errors (raised from 2)
    private static LATE_GAME_SCORE = 20;       // "Late game" starts at this score
    private static LATE_GAME_RUN = 2;          // Smaller run triggers in late game...
    private static LATE_GAME_GAP = 2;          // ...if opponent leads by this much
    private static MOMENTUM_WINDOW = 7;        // Look at last N terminal events for momentum score

    // Recovery cooldown: after a run is broken by myTeam scoring,
    // suppress new suggestions for this many terminal events
    private static RECOVERY_COOLDOWN = 3;

    /**
     * Analyzes match logs to determine momentum and timeout necessity.
     *
     * @param logs - Current set's stat logs
     * @param currentScore - Current score
     * @param servingTeam - Who is serving
     * @param lastDismissedAt - The score (myTeam + opponent total) when the coach last dismissed a suggestion.
     *                          Used for cooldown. Pass null if no dismissal active.
     */
    static analyze(
        logs: StatLog[],
        currentScore: Score,
        servingTeam: 'myTeam' | 'opponent',
        lastDismissedAt: number | null = null
    ): MomentumState {
        if (logs.length === 0) return { score: 0, trend: 'stable', suggestion: { shouldTimeout: false } };

        // 1. Calculate current opponent run: consecutive opponent points from most recent event.
        //    Any myTeam point or timeout breaks the run immediately.
        let opponentRun = 0;
        let errorChain = 0;

        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];

            // Timeout resets all runs
            if (log.type === 'timeout') break;

            const winner = getPointWinner(log);
            if (!winner) continue; // Skip non-scoring events (subs, rotations, etc.)

            if (winner === 'opponent') {
                opponentRun++;

                // Track error chain: only consecutive myTeam errors (not opponent winners)
                const isMyError = log.team === 'myTeam' && MY_TEAM_ERRORS.includes(log.type);
                if (isMyError) {
                    errorChain++;
                } else {
                    // Opponent earned the point (their kill/ace/block) — breaks error chain
                    // but does NOT break opponent run
                    errorChain = 0;
                }
            } else {
                // myTeam scored — the opponent run is broken. Stop counting.
                break;
            }
        }

        // 2. Recovery cooldown check
        // If the coach recently dismissed a suggestion, suppress for RECOVERY_COOLDOWN points
        const totalScore = currentScore.myTeam + currentScore.opponent;
        const inCooldown = lastDismissedAt !== null && (totalScore - lastDismissedAt) < this.RECOVERY_COOLDOWN;

        // 3. Determine timeout suggestion with graduated urgency
        let suggestion: string | null = null;
        let urgency: SuggestionUrgency = 'caution';

        // Score context: how critical is the situation?
        const scoreDiff = currentScore.opponent - currentScore.myTeam;
        const isLateGame = currentScore.opponent >= this.LATE_GAME_SCORE || currentScore.myTeam >= this.LATE_GAME_SCORE;

        // Scenario A: Opponent Run
        if (opponentRun >= this.RUN_THRESHOLD_URGENT) {
            suggestion = `Opponent Run (${opponentRun}-0)`;
            urgency = 'urgent';
        } else if (opponentRun >= this.RUN_THRESHOLD_CAUTION) {
            // Only show caution if the situation is actually concerning
            // (not when team is comfortably ahead)
            if (scoreDiff >= 0) {
                // Tied or trailing — caution is warranted
                suggestion = `Opponent Run (${opponentRun}-0)`;
                urgency = 'caution';
            }
        }

        // Scenario B: Error chain (myTeam giving away points)
        if (errorChain >= this.ERROR_CHAIN_THRESHOLD) {
            suggestion = `Consecutive Errors (${errorChain})`;
            urgency = errorChain >= 4 ? 'urgent' : 'caution';
        }

        // Scenario C: Late game pressure — lower thresholds
        if (isLateGame && opponentRun >= this.LATE_GAME_RUN && scoreDiff >= this.LATE_GAME_GAP) {
            suggestion = `Late Game Pressure`;
            urgency = scoreDiff >= 4 ? 'urgent' : 'caution';
        }

        // Apply cooldown suppression
        if (inCooldown && urgency !== 'urgent') {
            // During cooldown, only show urgent suggestions (suppress caution-level)
            suggestion = null;
        }

        // 4. Calculate Momentum Score (-100 to 100)
        // Expanded window (7 events instead of 5) for smoother signal
        // After timeout: seed with a slight negative bias rather than pure 0
        let momentumScore = 0;
        let count = 0;
        let hitTimeout = false;

        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];

            if (log.type === 'timeout') {
                hitTimeout = true;
                break;
            }

            const winner = getPointWinner(log);
            if (!winner) continue;

            // Recency weighting: most recent events matter more
            const weight = 20 - (count * 2);
            if (winner === 'myTeam') momentumScore += weight;
            else momentumScore -= weight;

            count++;
            if (count >= this.MOMENTUM_WINDOW) break;
        }

        // Post-timeout bias: if we just came out of a timeout and have few data points,
        // seed with a slight negative (the team was under pressure before the TO)
        if (hitTimeout && count <= 2) {
            momentumScore -= 10;
        }

        const clampedScore = Math.max(-100, Math.min(100, momentumScore));

        return {
            score: clampedScore,
            trend: clampedScore > 15 ? 'rising' : clampedScore < -15 ? 'falling' : 'stable',
            suggestion: {
                shouldTimeout: !!suggestion,
                urgency: suggestion ? urgency : undefined,
                reason: suggestion || undefined
            }
        };
    }
}
