import { StatLog } from '../types';
import { BaseStats, PlayerStats, RotationStats, TeamStats } from '../types/stats';

const INITIAL_BASE_STATS: BaseStats = {
    serveAttempts: 0,
    aces: 0,
    serveErrors: 0,
    serveRatingTotal: 0,
    pointsOnServe: 0,
    kills: 0,
    attackErrors: 0,
    attackAttempts: 0,
    blocked: 0,
    receptions: 0,
    receiveErrors: 0,
    receivePerfect: 0,
    receivePositive: 0,
    receiveRatingTotal: 0,
    sideouts: 0,
    soloBlocks: 0,
    assistBlocks: 0,
    blockErrors: 0,
    digs: 0,
    digErrors: 0,
    assists: 0,
    ballHandlingErrors: 0,
    totalPoints: 0,
    unforcedErrors: 0
};

export class StatsEngine {

    /**
     * Aggregates logs into player-specific stats.
     */
    static calculatePlayerStats(logs: StatLog[], myTeamId: string = 'myTeam'): Record<string, PlayerStats> {
        const playerMap: Record<string, PlayerStats> = {};

        const getPlayer = (id: string): PlayerStats => {
            if (!playerMap[id]) {
                playerMap[id] = { ...INITIAL_BASE_STATS, playerId: id, setsPlayed: 0 };
            }
            return playerMap[id];
        };

        // Determine sets played roughly by unique set numbers a player appears in
        const playerSets: Record<string, Set<number>> = {};
        const trackSet = (id: string, s: number) => {
            if (!playerSets[id]) playerSets[id] = new Set();
            playerSets[id].add(s);
        };

        logs.forEach(log => {
            if (log.team !== myTeamId) {
                return;
            }

            // Primary Actor
            if (log.playerId) {
                const p = getPlayer(log.playerId);
                trackSet(log.playerId, log.setNumber);

                switch (log.type) {
                    // SERVE
                    case 'ace':
                        p.serveAttempts++;
                        p.aces++;
                        p.totalPoints++;
                        p.serveRatingTotal += 4;
                        break;
                    case 'serve_good':
                        p.serveAttempts++;
                        p.serveRatingTotal += 2; // Arbitrary 'good' rating
                        break;
                    case 'serve_error':
                        p.serveAttempts++;
                        p.serveErrors++;
                        p.unforcedErrors++;
                        p.serveRatingTotal += 0;
                        break;

                    // ATTACK
                    case 'kill':
                        p.attackAttempts++;
                        p.kills++;
                        p.totalPoints++;
                        break;
                    case 'attack_good':
                        p.attackAttempts++;
                        break;
                    case 'attack_error':
                        p.attackAttempts++;
                        p.attackErrors++;
                        p.unforcedErrors++;
                        break;
                    case 'block':
                        // Note: A 'block' log usually means a Kill for us via a Block.
                        // Can be solo or assist. If log doesn't specify, assume Solo? 
                        // Often difficult to distinguish solo/assist in simple UI.
                        p.soloBlocks++;
                        p.totalPoints++;
                        break;

                    // DIG
                    case 'dig':
                        p.digs++;
                        break;
                    case 'dig_error':
                        p.digErrors++;
                        break;

                    // RECEIVE
                    case 'receive_0': // Error
                        p.receptions++;
                        p.receiveErrors++;
                        p.unforcedErrors++;
                        break;
                    case 'receive_1':
                        p.receptions++;
                        p.receiveRatingTotal += 1;
                        break;
                    case 'receive_2':
                        p.receptions++;
                        p.receivePositive++;
                        p.receiveRatingTotal += 2;
                        break;
                    case 'receive_3': // Perfect
                        p.receptions++;
                        p.receivePositive++;
                        p.receivePerfect++;
                        p.receiveRatingTotal += 3;
                        break;
                }
            }

            // Assist (Setter)
            if (log.assistPlayerId) {
                const setter = getPlayer(log.assistPlayerId);
                trackSet(log.assistPlayerId, log.setNumber);
                if (log.type === 'kill') {
                    setter.assists++;
                }
            }
        });

        // Finalize Sets Played
        Object.keys(playerMap).forEach(pid => {
            playerMap[pid].setsPlayed = playerSets[pid]?.size || 0;
        });

        return playerMap;
    }

    /**
     * Aggregates logs into Team Totals
     */
    static calculateTeamStats(logs: StatLog[], myTeamName: string = 'myTeam'): TeamStats {
        const stats: TeamStats = {
            ...INITIAL_BASE_STATS,
            setsPlayed: 0,
            setsWon: 0
        };

        const uniqueSets = new Set<number>();
        // Just need to sum up all the player stats essentially, OR iterate logs again.
        // Iterating logs allows capturing "System" stats that might not have a playerId.

        logs.forEach(log => {
            uniqueSets.add(log.setNumber);

            // Count for "My Team"
            // Be careful: 'serve_error' by OPPONENT is a point for us, but not a STAT for us.
            // We only count actions performed BY us.
            if (log.team !== 'myTeam') return;

            switch (log.type) {
                case 'ace':
                    stats.serveAttempts++;
                    stats.aces++;
                    stats.totalPoints++;
                    break;
                case 'serve_good':
                    stats.serveAttempts++;
                    break;
                case 'serve_error':
                    stats.serveAttempts++;
                    stats.serveErrors++;
                    stats.unforcedErrors++;
                    break;
                case 'kill':
                    stats.attackAttempts++;
                    stats.kills++;
                    stats.totalPoints++;
                    if (log.assistPlayerId) stats.assists++;
                    break;
                case 'attack_good':
                    stats.attackAttempts++;
                    break;
                case 'attack_error':
                    stats.attackAttempts++;
                    stats.attackErrors++;
                    stats.unforcedErrors++;
                    break;
                case 'block':
                    stats.soloBlocks++;
                    stats.totalPoints++;
                    break;
                case 'dig':
                    stats.digs++;
                    break;
                case 'dig_error':
                    stats.digErrors++;
                    break;
                case 'receive_0':
                    stats.receptions++;
                    stats.receiveErrors++;
                    stats.unforcedErrors++;
                    break;
                case 'receive_1':
                    stats.receptions++;
                    stats.receiveRatingTotal += 1;
                    break;
                case 'receive_2':
                    stats.receptions++;
                    stats.receivePositive++;
                    stats.receiveRatingTotal += 2;
                    break;
                case 'receive_3':
                    stats.receptions++;
                    stats.receivePositive++;
                    stats.receivePerfect++;
                    stats.receiveRatingTotal += 3;
                    break;
            }
        });

        // Determine Sets Won/Played
        stats.setsPlayed = uniqueSets.size;

        uniqueSets.forEach(setNum => {
            // Find last log of this set to get final score
            const setLogs = logs.filter(l => l.setNumber === setNum);
            if (setLogs.length > 0) {
                // Sort by timestamp desc to get last event
                setLogs.sort((a, b) => b.timestamp - a.timestamp);
                const lastLog = setLogs[0];

                // Check score snapshot
                if (lastLog.scoreSnapshot) {
                    const { myTeam, opponent } = lastLog.scoreSnapshot;
                    if (myTeam > opponent) {
                        stats.setsWon++;
                    }
                }
            }
        });

        return stats;
    }

    /**
     * Calculates derived metrics (Sideout %, Point Scoring %)
     * Requires reconstructing rally flow to know who served.
     */
    static calculateAdvancedTeamStats(logs: StatLog[]) {
        let sideoutOpp = 0;
        let sideoutSuccess = 0;
        let serveOpp = 0;
        let servePoint = 0;

        // need to sort logs by timestamp just in case
        const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);

        // We process rally-by-rally.
        // A rally ends with a point (Kill, Ace, Error).
        // We look at the 'servingTeam' of that rally.
        // But StatLog doesn't explicitly store "servingTeam" for every log, 
        // only `servingTeamSnapshot` usually available on some logs or we deduce it.

        // Actually, our StatLog schema has `servingTeamSnapshot`. Excellent.

        // We iterate terminal events (those that change score).
        sorted.forEach(log => {
            const isTerminal = ['ace', 'serve_error', 'kill', 'attack_error', 'dig_error', 'receive_0', 'block'].includes(log.type);

            if (isTerminal && log.servingTeamSnapshot) {
                const servingTeam = log.servingTeamSnapshot;
                const recievingTeam = servingTeam === 'myTeam' ? 'opponent' : 'myTeam';
                const winner = (log.type === 'ace' || log.type === 'kill' || log.type === 'block') ? log.team : (log.team === 'myTeam' ? 'opponent' : 'myTeam');

                if (servingTeam === 'myTeam') {
                    serveOpp++;
                    if (winner === 'myTeam') {
                        servePoint++;
                    }
                } else {
                    // We are receiving
                    sideoutOpp++;
                    if (winner === 'myTeam') {
                        sideoutSuccess++;
                    }
                }
            }
        });

        return {
            sideoutPct: sideoutOpp > 0 ? sideoutSuccess / sideoutOpp : 0,
            pointScoringPct: serveOpp > 0 ? servePoint / serveOpp : 0,
        };
    }
    /**
     * Calculates stats broken down by rotation (Setter Position).
     * Heuristic: Identifies the "Active Setter" to determine Rotation 1-6.
     */
    static calculateRotationStats(logs: StatLog[], roster: any[]): Record<number, RotationStats> {
        const rotationMap: Record<number, RotationStats> = {
            1: { rotation: 1, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
            2: { rotation: 2, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
            3: { rotation: 3, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
            4: { rotation: 4, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
            5: { rotation: 5, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
            6: { rotation: 6, pointsScored: 0, pointsLost: 0, sideoutCount: 0, sideoutOpportunities: 0 },
        };

        const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);

        sorted.forEach(log => {
            const isTerminal = ['ace', 'serve_error', 'kill', 'attack_error', 'dig_error', 'receive_0', 'block'].includes(log.type);

            if (isTerminal && log.rotationSnapshot && log.servingTeamSnapshot) {
                // Determine Rotation Index (Setter Position)
                let rotationIdx = 1; // Default

                // Find Setter
                // Need to cross-ref player IDs in snapshot with Roster to check positions
                // This implies passing Roster to this function.
                // Snapshot has { playerId, position }.

                // Heuristic: Find player with 'S' in active rotation
                const currentRotation = log.rotationSnapshot;
                let setterSlot = currentRotation.find(slot => {
                    const p = roster.find(r => r.id === slot.playerId);
                    return p && p.positions && p.positions.includes('S');
                });

                // Refinement for 6-2: If multiple Setters, prefer Back Row (1, 6, 5)
                const setters = currentRotation.filter(slot => {
                    const p = roster.find(r => r.id === slot.playerId);
                    return p && p.positions && p.positions.includes('S');
                });

                if (setters.length > 1) {
                    const backRowSetter = setters.find(s => [1, 6, 5].includes(s.position));
                    if (backRowSetter) setterSlot = backRowSetter;
                }

                if (setterSlot) {
                    rotationIdx = setterSlot.position;
                }

                const stats = rotationMap[rotationIdx];
                const servingTeam = log.servingTeamSnapshot;
                const winner = (log.type === 'ace' || log.type === 'kill' || log.type === 'block') ? log.team : (log.team === 'myTeam' ? 'opponent' : 'myTeam');

                if (servingTeam === 'myTeam') {
                    // We served.
                    if (winner === 'myTeam') {
                        stats.pointsScored++;
                    } else {
                        stats.pointsLost++;
                    }
                } else {
                    // We received.
                    stats.sideoutOpportunities++;
                    if (winner === 'myTeam') {
                        stats.sideoutCount++;
                        stats.pointsScored++;
                    } else {
                        stats.pointsLost++;
                    }
                }
            }
        });

        return rotationMap;
    }
    /**
     * Aggregates multiple TeamStats objects into one.
     * Useful for summing season/event totals where setsPlayed needs to be additive,
     * not re-calculated from unique set numbers across matches.
     */
    static aggregateTeamStats(statsList: TeamStats[]): TeamStats {
        const total = { ...INITIAL_BASE_STATS, setsPlayed: 0, setsWon: 0 };

        statsList.forEach(s => {
            total.serveAttempts += s.serveAttempts;
            total.aces += s.aces;
            total.serveErrors += s.serveErrors;
            total.serveRatingTotal += s.serveRatingTotal;
            total.pointsOnServe += s.pointsOnServe;
            total.kills += s.kills;
            total.attackErrors += s.attackErrors;
            total.attackAttempts += s.attackAttempts;
            total.blocked += s.blocked;
            total.receptions += s.receptions;
            total.receiveErrors += s.receiveErrors;
            total.receivePerfect += s.receivePerfect;
            total.receivePositive += s.receivePositive;
            total.receiveRatingTotal += s.receiveRatingTotal;
            total.sideouts += s.sideouts;
            total.soloBlocks += s.soloBlocks;
            total.assistBlocks += s.assistBlocks;
            total.blockErrors += s.blockErrors;
            total.digs += s.digs;
            total.digErrors += s.digErrors;
            total.assists += s.assists;
            total.ballHandlingErrors += s.ballHandlingErrors;
            total.totalPoints += s.totalPoints;
            total.unforcedErrors += s.unforcedErrors;

            total.setsPlayed += s.setsPlayed;
            total.setsWon += s.setsWon;
        });

        return total;
    }
}
