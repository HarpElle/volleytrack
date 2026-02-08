
export type StatContext = 'match' | 'event' | 'season';

export interface BaseStats {
    // Serving
    serveAttempts: number;
    aces: number;
    serveErrors: number;
    serveRatingTotal: number; // Sum of 0-4 ratings if available
    pointsOnServe: number; // Rally won while serving

    // Attack
    kills: number;
    attackErrors: number;
    attackAttempts: number;
    blocked: number; // Times strictly blocked (optional, derived from attack errors usually)

    // Receive
    receptions: number;
    receiveErrors: number; // 0-option
    receivePerfect: number; // 3-option
    receivePositive: number; // 2 or 3
    receiveRatingTotal: number; // Sum of 0-3 ratings
    sideouts: number; // Rally won on receive

    // Block
    soloBlocks: number;
    assistBlocks: number;
    blockErrors: number;

    // Defense
    digs: number;
    digErrors: number;

    // Ball Handling
    assists: number;
    ballHandlingErrors: number;

    // Points
    totalPoints: number; // Kills + Aces + Blocks
    unforcedErrors: number; // Serve Err + Atk Err + BH Err + Rec Err
}

export interface PlayerStats extends BaseStats {
    playerId: string;
    setsPlayed: number;

    // Calculated Rates (Helpers for UI, but data is source of truth)
    // hittingPct = (kills - errors) / attempts
    // passRating = ratingTotal / receptions
}

export interface TeamStats extends BaseStats {
    setsPlayed: number;
    setsWon: number;
    matchesPlayed?: number;
    matchesWon?: number;
}

export interface RotationStats {
    rotation: 1 | 2 | 3 | 4 | 5 | 6; // P1 is server
    pointsScored: number;
    pointsLost: number;
    sideoutCount: number;
    sideoutOpportunities: number;
}

export interface BenchmarkProfile {
    id: string;
    name: string; // e.g. "U16 Club", "Varsity"
    targets: {
        hittingPct: number;
        killPct: number;
        passRating: number;
        serveAcePct: number;
        serveErrorPct: number;
        sideoutPct: number;
        pointScoringPct: number;
    };
}
