/**
 * Live Match Broadcast Service
 *
 * Real-time broadcasting for spectator view. Coaches push live match state
 * to Firestore; spectators subscribe via onSnapshot listeners.
 *
 * Schema:
 *   liveMatches/{matchCode} → LiveMatchSnapshot document
 *
 * Security:
 *   - Public read (spectators don't need auth)
 *   - Write restricted to coach who created the broadcast (coachUid field)
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
    LiveMatchSnapshot,
    MatchState,
    Player,
    Score,
    StatLog,
    LineupPosition,
    SetResult,
    MatchConfig,
    Team,
} from '../../types';

// Characters for match code (excludes ambiguous 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_HISTORY_ENTRIES = 50;

/**
 * Strip undefined values from an object (deep).
 * Firestore rejects documents containing `undefined` fields.
 * JSON round-trip naturally drops undefined properties and converts them to null in arrays.
 */
function stripUndefined<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate a random 6-character match code
 */
export function generateMatchCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
}

/**
 * Validate match code format
 */
export function isValidMatchCode(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Build a broadcast-safe snapshot from the current match state.
 * Trims history to last N entries to stay under Firestore's 1MB doc limit.
 */
export function buildSnapshot(
    state: MatchState,
    status: 'live' | 'between-sets' | 'completed' = 'live'
): LiveMatchSnapshot['currentState'] {
    const trimmedHistory = (state.history || []).slice(-MAX_HISTORY_ENTRIES);

    return {
        myTeamName: state.myTeamName,
        opponentName: state.opponentName,
        currentSet: state.currentSet,
        scores: state.scores,
        setsWon: state.setsWon,
        servingTeam: state.servingTeam,
        rallyState: state.rallyState,
        currentRotation: state.currentRotation || [],
        myTeamRoster: state.myTeamRoster || [],
        history: trimmedHistory,
        setHistory: state.setHistory || [],
        timeoutsRemaining: state.timeoutsRemaining,
        subsRemaining: state.subsRemaining,
        config: state.config,
        status,
    };
}

/**
 * Start broadcasting a live match. Creates a Firestore document with a unique code.
 * Retries up to 5 times if code collision occurs.
 */
export async function startLiveMatch(
    coachUid: string,
    matchId: string,
    state: MatchState
): Promise<{ success: boolean; matchCode: string; error?: string }> {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const matchCode = generateMatchCode();
        const docRef = doc(db, 'liveMatches', matchCode);

        try {
            // Check if code already exists
            const existing = await getDoc(docRef);
            if (existing.exists()) continue; // Code collision, try again

            const snapshot: LiveMatchSnapshot = stripUndefined({
                matchCode,
                coachUid,
                matchId,
                isActive: true,
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                currentState: buildSnapshot(state),
            });

            await setDoc(docRef, snapshot);
            return { success: true, matchCode };
        } catch (error: any) {
            if (attempt === maxRetries - 1) {
                return { success: false, matchCode: '', error: error.message || 'Failed to start broadcast' };
            }
        }
    }

    return { success: false, matchCode: '', error: 'Could not generate unique match code' };
}

/**
 * Push a state update to an existing live match broadcast.
 */
export async function updateLiveMatch(
    matchCode: string,
    coachUid: string,
    state: MatchState,
    status: 'live' | 'between-sets' | 'completed' = 'live'
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, stripUndefined({
            lastUpdated: Date.now(),
            isActive: status !== 'completed',
            currentState: buildSnapshot(state, status),
        }));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to update broadcast' };
    }
}

/**
 * Stop broadcasting (sets isActive to false but keeps the document).
 */
export async function stopLiveMatch(
    matchCode: string,
    coachUid: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, {
            isActive: false,
            lastUpdated: Date.now(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to stop broadcast' };
    }
}

/**
 * Delete the live match document entirely.
 */
export async function deleteLiveMatch(
    matchCode: string,
    coachUid: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await deleteDoc(docRef);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete broadcast' };
    }
}

/**
 * One-time fetch to check if a live match exists and is active.
 */
export async function getLiveMatch(
    matchCode: string
): Promise<{ success: boolean; match: LiveMatchSnapshot | null; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            return { success: false, match: null, error: 'Match not found' };
        }

        const data = snapshot.data() as LiveMatchSnapshot;
        return { success: true, match: data };
    } catch (error: any) {
        return { success: false, match: null, error: error.message || 'Failed to fetch match' };
    }
}

/**
 * Subscribe to real-time updates for a live match.
 * Returns an unsubscribe function to clean up the listener.
 */
export function subscribeLiveMatch(
    matchCode: string,
    onUpdate: (match: LiveMatchSnapshot) => void,
    onError: (error: string) => void
): () => void {
    const docRef = doc(db, 'liveMatches', matchCode);

    const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                onError('Match not found');
                return;
            }
            const data = snapshot.data() as LiveMatchSnapshot;
            onUpdate(data);
        },
        (error) => {
            onError(error.message || 'Connection error');
        }
    );

    return unsubscribe;
}

/**
 * Clean up stale broadcasts left behind by this coach
 * (e.g. app was force-quit mid-broadcast).
 * Marks any active broadcasts older than STALE_THRESHOLD as inactive.
 */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function cleanupStaleBroadcasts(coachUid: string): Promise<number> {
    try {
        const q = query(
            collection(db, 'liveMatches'),
            where('coachUid', '==', coachUid),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        const now = Date.now();
        let cleaned = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as LiveMatchSnapshot;
            if (now - data.lastUpdated > STALE_THRESHOLD_MS) {
                await updateDoc(docSnap.ref, { isActive: false });
                cleaned++;
            }
        }

        return cleaned;
    } catch (_) {
        // Silently fail — cleanup is best-effort
        return 0;
    }
}
