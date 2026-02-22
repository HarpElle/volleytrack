/**
 * Live Match Broadcast Service
 *
 * Real-time broadcasting for spectator view. Coaches push live match state
 * to Firestore; spectators subscribe via onSnapshot listeners.
 *
 * Schema:
 *   liveMatches/{matchCode}                → Match state document (coach writes, spectators read)
 *   liveMatches/{matchCode}/meta/interactions → Spectator data (spectators write, coach reads)
 *
 * Optimizations:
 *   - Spectator interactions separated into subcollection to eliminate write contention
 *   - Delta updates: only changed fields are pushed (not the full state every time)
 *   - History entries stripped of bulky snapshots (rotationSnapshot, metadata)
 *   - Reduced history limit (30 entries, double the 15 displayed to spectators)
 *
 * Security:
 *   - Public read (spectators don't need auth)
 *   - Main doc write restricted to coach (coachUid field)
 *   - Interactions subdoc writable by anyone (spectators)
 */

import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import {
    LiveMatchSnapshot,
    MatchState,
    StatLog
} from '../../types';
import { db } from './config';

// Characters for match code (excludes ambiguous 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_HISTORY_ENTRIES = 30; // Reduced from 50; spectators display 15, this is 2x buffer

// ── Snapshot Cache for Delta Updates ─────────────────────────────────────────
// Module-level cache of the last pushed state per match code.
// Used to compute delta updates instead of full state replacement.
const lastPushedStateCache = new Map<string, {
    scores: string;
    currentSet: number;
    setsWon: string;
    servingTeam: string;
    rallyState: string;
    historyLength: number;
    rotationKey: string;
    timeouts: string;
    subs: string;
    setHistoryLength: number;
}>();

/**
 * Strip undefined values from an object (deep).
 * Firestore rejects documents containing `undefined` fields.
 * JSON round-trip naturally drops undefined properties and converts them to null in arrays.
 */
function stripUndefined<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Strip bulky snapshot data from history entries for broadcast.
 * Spectators don't need rotationSnapshot or metadata per event.
 */
function trimHistoryEntry(entry: StatLog): Partial<StatLog> {
    return {
        id: entry.id,
        timestamp: entry.timestamp,
        type: entry.type,
        team: entry.team,
        scoreSnapshot: entry.scoreSnapshot,
        setNumber: entry.setNumber,
        playerId: entry.playerId,
        assistPlayerId: entry.assistPlayerId,
        rallyStateSnapshot: entry.rallyStateSnapshot,
        servingTeamSnapshot: entry.servingTeamSnapshot,
        // Intentionally omitted: rotationSnapshot, metadata (large, not used by spectators)
    };
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
 * Trims history to last N entries and strips bulky per-entry data.
 */
export function buildSnapshot(
    state: MatchState,
    status: 'live' | 'between-sets' | 'completed' = 'live'
): LiveMatchSnapshot['currentState'] {
    const trimmedHistory = (state.history || [])
        .slice(-MAX_HISTORY_ENTRIES)
        .map(trimHistoryEntry) as StatLog[];

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
 * Build a fingerprint of the current state for delta comparison.
 */
function buildStateFingerprint(state: MatchState) {
    const rotation = state.currentRotation || [];
    return {
        scores: JSON.stringify(state.scores),
        currentSet: state.currentSet,
        setsWon: JSON.stringify(state.setsWon),
        servingTeam: state.servingTeam,
        rallyState: state.rallyState,
        historyLength: (state.history || []).length,
        rotationKey: rotation.map(p => `${p.position}:${p.playerId || '-'}`).join(','),
        timeouts: JSON.stringify(state.timeoutsRemaining),
        subs: JSON.stringify(state.subsRemaining),
        setHistoryLength: (state.setHistory || []).length,
    };
}

/**
 * Build a selective update object containing only the fields that changed.
 * Returns null if nothing changed, or a flat object with dot-notation keys
 * suitable for Firestore updateDoc.
 */
function buildDeltaUpdate(
    matchCode: string,
    state: MatchState,
    status: 'live' | 'between-sets' | 'completed'
): Record<string, any> | null {
    const current = buildStateFingerprint(state);
    const prev = lastPushedStateCache.get(matchCode);

    // No previous state — do a full push
    if (!prev) {
        lastPushedStateCache.set(matchCode, current);
        return null; // Caller should do full update
    }

    const delta: Record<string, any> = {
        lastUpdated: Date.now(),
        isActive: status !== 'completed',
    };
    let hasChanges = false;

    // Check each field and only include changed ones
    if (current.scores !== prev.scores) {
        delta['currentState.scores'] = state.scores;
        hasChanges = true;
    }
    if (current.currentSet !== prev.currentSet) {
        delta['currentState.currentSet'] = state.currentSet;
        hasChanges = true;
    }
    if (current.setsWon !== prev.setsWon) {
        delta['currentState.setsWon'] = state.setsWon;
        hasChanges = true;
    }
    if (current.servingTeam !== prev.servingTeam) {
        delta['currentState.servingTeam'] = state.servingTeam;
        hasChanges = true;
    }
    if (current.rallyState !== prev.rallyState) {
        delta['currentState.rallyState'] = state.rallyState;
        hasChanges = true;
    }
    if (current.historyLength !== prev.historyLength) {
        // History changed — push trimmed version
        const trimmedHistory = (state.history || [])
            .slice(-MAX_HISTORY_ENTRIES)
            .map(trimHistoryEntry);
        delta['currentState.history'] = trimmedHistory;
        hasChanges = true;
    }
    if (current.rotationKey !== prev.rotationKey) {
        delta['currentState.currentRotation'] = state.currentRotation || [];
        // Re-push roster alongside rotation so spectators can always resolve names
        delta['currentState.myTeamRoster'] = state.myTeamRoster || [];
        hasChanges = true;
    }
    if (current.timeouts !== prev.timeouts) {
        delta['currentState.timeoutsRemaining'] = state.timeoutsRemaining;
        hasChanges = true;
    }
    if (current.subs !== prev.subs) {
        delta['currentState.subsRemaining'] = state.subsRemaining;
        hasChanges = true;
    }
    if (current.setHistoryLength !== prev.setHistoryLength) {
        delta['currentState.setHistory'] = state.setHistory || [];
        hasChanges = true;
    }

    // Always update status
    delta['currentState.status'] = status;

    // Cache current state for next comparison
    lastPushedStateCache.set(matchCode, current);

    return hasChanges ? delta : null;
}

/**
 * Start broadcasting a live match. Creates a Firestore document with a unique code.
 * Also creates the interactions subdoc for spectator writes.
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
        if (!db) throw new Error('Firestore not initialized');
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
                broadcastSettings: { allowSpectatorAlerts: true },
                // Note: spectators, spectatorAlerts, cheerCount now live in meta/interactions
            });

            await setDoc(docRef, snapshot);

            // Create the interactions subdoc for spectator writes
            if (!db) throw new Error('Firestore not initialized');
            const interactionsRef = doc(db, 'liveMatches', matchCode, 'meta', 'interactions');
            await setDoc(interactionsRef, {
                spectators: {},
                spectatorCount: 0,
                spectatorAlerts: [],
                cheerCount: 0,
                lastCheerAt: null,
            });

            // Clear any stale cache and seed with initial state
            lastPushedStateCache.set(matchCode, buildStateFingerprint(state));

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
 * Uses delta updates to minimize payload size and Firestore write cost.
 * Falls back to full snapshot on first push or when delta computation fails.
 */
export async function updateLiveMatch(
    matchCode: string,
    coachUid: string,
    state: MatchState,
    status: 'live' | 'between-sets' | 'completed' = 'live'
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = doc(db, 'liveMatches', matchCode);

        // Try delta update first
        const delta = buildDeltaUpdate(matchCode, state, status);

        if (delta) {
            // Delta update — only changed fields
            await updateDoc(docRef, stripUndefined(delta));
        } else {
            // Full update (first push after start, or no cached state)
            await updateDoc(docRef, stripUndefined({
                lastUpdated: Date.now(),
                isActive: status !== 'completed',
                currentState: buildSnapshot(state, status),
            }));
        }

        return { success: true };
    } catch (error: any) {
        // If delta update fails, clear cache so next push does full update
        lastPushedStateCache.delete(matchCode);
        return { success: false, error: error.message || 'Failed to update broadcast' };
    }
}

/**
 * Update broadcast settings (e.g. toggle spectator alerts on/off).
 */
export async function updateBroadcastSettings(
    matchCode: string,
    settings: { allowSpectatorAlerts: boolean }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, { broadcastSettings: settings });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to update settings' };
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
        if (!db) throw new Error('Firestore not initialized');
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, {
            isActive: false,
            lastUpdated: Date.now(),
        });
        // Clean up cache
        lastPushedStateCache.delete(matchCode);
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
        if (!db) throw new Error('Firestore not initialized');
        const docRef = doc(db, 'liveMatches', matchCode);
        await deleteDoc(docRef);
        lastPushedStateCache.delete(matchCode);
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
        if (!db) throw new Error('Firestore not initialized');
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
 * Subscribe to real-time match STATE updates only.
 * Spectator interactions are in a separate subcollection (meta/interactions).
 * Returns an unsubscribe function to clean up the listener.
 */
export function subscribeLiveMatch(
    matchCode: string,
    onUpdate: (match: LiveMatchSnapshot) => void,
    onError: (error: string) => void
): () => void {
    if (!db) {
        onError('Firestore not initialized');
        return () => { };
    }
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
 * Subscribe to the spectator interactions subdoc (meta/interactions).
 * Used by the coach to see viewer count and alerts,
 * and by spectators to see cheer count and other viewer data.
 */
export function subscribeInteractions(
    matchCode: string,
    onUpdate: (data: any) => void,
    onError: (error: string) => void
): () => void {
    if (!db) {
        onError('Firestore not initialized');
        return () => { };
    }
    const interactionsRef = doc(db, 'liveMatches', matchCode, 'meta', 'interactions');

    const unsubscribe = onSnapshot(
        interactionsRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                // Interactions doc not created yet — treat as empty
                onUpdate({
                    spectators: {},
                    spectatorCount: 0,
                    spectatorAlerts: [],
                    cheerCount: 0,
                    lastCheerAt: null,
                });
                return;
            }
            onUpdate(snapshot.data());
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
        if (!db) throw new Error('Firestore not initialized');
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
