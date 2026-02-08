import { Score, StatLog } from '../types';

export interface MomentumState {
    score: number; // -100 (Bad) to 100 (Good)
    trend: 'rising' | 'falling' | 'stable';
    suggestion: {
        shouldTimeout: boolean;
        reason?: string;
    };
}

export class MomentumTracker {

    // Sensitivity Config
    private static RUN_THRESHOLD = 3; // Opponent points in a row
    private static ERROR_CHAIN_THRESHOLD = 2; // Consecutive unforced errors
    private static LATE_GAME_GAP = 3; // Point gap after 20 points

    /**
     * Analyzes the last N logs to determine momentum and timeout necessity.
     */
    static analyze(logs: StatLog[], currentScore: Score, servingTeam: 'myTeam' | 'opponent'): MomentumState {
        if (logs.length < 3) return { score: 0, trend: 'stable', suggestion: { shouldTimeout: false } };

        // 1. Calculate Run
        let opponentRun = 0;
        let myRun = 0;
        let errorChain = 0;

        // Iterate backwards
        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];

            if (log.type === 'timeout') break; // Timeout resets runs

            // Score Change detection
            // Note: simple logs might not have "winner" explicitly, we infer from type/team
            const isTerminal = ['ace', 'serve_error', 'kill', 'attack_error', 'dig_error', 'receive_0', 'block'].includes(log.type);
            if (!isTerminal) continue;

            const winner = (log.type === 'ace' || log.type === 'kill' || log.type === 'block') ? log.team : (log.team === 'myTeam' ? 'opponent' : 'myTeam');

            if (winner === 'opponent') {
                opponentRun++;
                myRun = 0; // Reset my run
            } else {
                myRun++;
                opponentRun = 0;
                break; // Opponent run broken
            }

            // Error Chain (My Team Errors)
            const myError = (log.team === 'myTeam' && ['serve_error', 'attack_error', 'dig_error', 'receive_0', 'set_error'].includes(log.type));
            if (myError) errorChain++;
            else if (winner === 'opponent') {
                // Opponent earned point (kill/ace) breaks error chain?
                // Maybe, but let's say "Consecutive points via errors"
                errorChain = 0;
            }
        }

        // 2. Determine Timeout Suggestion
        let suggestion = null;

        // Scenario A: The Run
        if (opponentRun >= this.RUN_THRESHOLD) {
            suggestion = `Opponent Run (${opponentRun}-0)`;
        }

        // Scenario B: The Meltdown (Errors)
        if (errorChain >= this.ERROR_CHAIN_THRESHOLD) {
            suggestion = `Consecutive Errors (${errorChain})`;
        }

        // Scenario C: Late Game Pressure
        const isLateGame = currentScore.opponent >= 20;
        if (isLateGame && opponentRun >= 2 && (currentScore.opponent - currentScore.myTeam >= 2)) {
            suggestion = `Gap Widening`;
        }

        // Calculate Momentum Score (Simple heuristic)
        // range -100 to 100.
        // Start at 0.
        // Recent 5 points: +20 for win, -20 for loss.
        let momentumScore = 0;
        let count = 0;
        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];

            if (log.type === 'timeout') break; // Timeout resets momentum

            if (!['ace', 'serve_error', 'kill', 'attack_error', 'dig_error', 'receive_0', 'block'].includes(log.type)) continue;

            const winner = (log.type === 'ace' || log.type === 'kill' || log.type === 'block') ? log.team : (log.team === 'myTeam' ? 'opponent' : 'myTeam');
            if (winner === 'myTeam') momentumScore += (20 - (count * 2)); // Recent points weigh more
            else momentumScore -= (20 - (count * 2));

            count++;
            if (count >= 5) break;
        }

        return {
            score: Math.max(-100, Math.min(100, momentumScore)),
            trend: momentumScore > 10 ? 'rising' : momentumScore < -10 ? 'falling' : 'stable',
            suggestion: {
                shouldTimeout: !!suggestion,
                reason: suggestion || undefined
            }
        };
    }
}
