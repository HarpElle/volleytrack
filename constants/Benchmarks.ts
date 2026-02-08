import { BenchmarkProfile } from '../types/stats';

export const BENCHMARKS: BenchmarkProfile[] = [
    {
        id: 'u14_club',
        name: 'U14 Club',
        targets: {
            hittingPct: 0.175,
            killPct: 0.30,
            passRating: 1.9,
            serveAcePct: 0.12,
            serveErrorPct: 0.15,
            sideoutPct: 0.45,
            pointScoringPct: 0.35
        }
    },
    {
        id: 'u16_club',
        name: 'U16 Club',
        targets: {
            hittingPct: 0.225,
            killPct: 0.35,
            passRating: 2.1,
            serveAcePct: 0.10,
            serveErrorPct: 0.12,
            sideoutPct: 0.52,
            pointScoringPct: 0.40
        }
    },
    {
        id: 'varsity',
        name: 'Varsity HS',
        targets: {
            hittingPct: 0.250,
            killPct: 0.38,
            passRating: 2.2,
            serveAcePct: 0.08,
            serveErrorPct: 0.10,
            sideoutPct: 0.55,
            pointScoringPct: 0.42
        }
    },
    {
        id: 'collegiate',
        name: 'Collegiate',
        targets: {
            hittingPct: 0.285,
            killPct: 0.42,
            passRating: 2.35,
            serveAcePct: 0.06,
            serveErrorPct: 0.08,
            sideoutPct: 0.62,
            pointScoringPct: 0.48
        }
    }
];

export const DEFAULT_TARGET_PROFILE = BENCHMARKS[1]; // U16 as mid-tier default
