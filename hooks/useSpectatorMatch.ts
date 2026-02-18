/**
 * Spectator-side hook for subscribing to a live match broadcast.
 *
 * Usage:
 *   const { match, loading, error, isConnected } = useSpectatorMatch('ABC123');
 *
 * Subscribes to Firestore onSnapshot on mount, unsubscribes on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeLiveMatch } from '../services/firebase/liveMatchService';
import { LiveMatchSnapshot } from '../types';

/**
 * Build a lightweight fingerprint of the match state so we can skip
 * React state updates (and the resulting re-render cascade) when the
 * Firestore snapshot hasn't changed in a meaningful way.
 */
function snapshotFingerprint(m: LiveMatchSnapshot): string {
    const s = m.currentState;
    if (!s) return `${m.isActive}`;
    return [
        m.isActive,
        s.currentSet,
        s.status,
        s.servingTeam,
        s.rallyState,
        JSON.stringify(s.scores),
        JSON.stringify(s.setsWon),
        s.history?.length ?? 0,
        s.currentRotation?.map(p => p.playerId).join(',') ?? '',
        JSON.stringify(s.timeoutsRemaining),
    ].join('|');
}

export function useSpectatorMatch(matchCode: string) {
    const [match, setMatch] = useState<LiveMatchSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const lastFingerprintRef = useRef<string>('');

    const handleSnapshot = useCallback((updatedMatch: LiveMatchSnapshot) => {
        const fp = snapshotFingerprint(updatedMatch);
        if (fp !== lastFingerprintRef.current) {
            lastFingerprintRef.current = fp;
            setMatch(updatedMatch);
        }
        setLoading(false);
        setError(null);
        setIsConnected(true);
    }, []);

    useEffect(() => {
        if (!matchCode) {
            setLoading(false);
            setError('No match code provided');
            return;
        }

        setLoading(true);
        setError(null);
        lastFingerprintRef.current = '';

        const unsubscribe = subscribeLiveMatch(
            matchCode,
            handleSnapshot,
            (err) => {
                setError(err);
                setLoading(false);
                setIsConnected(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [matchCode, handleSnapshot]);

    return { match, loading, error, isConnected };
}
