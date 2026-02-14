/**
 * Spectator-side hook for subscribing to a live match broadcast.
 *
 * Usage:
 *   const { match, loading, error, isConnected } = useSpectatorMatch('ABC123');
 *
 * Subscribes to Firestore onSnapshot on mount, unsubscribes on unmount.
 */

import { useEffect, useState } from 'react';
import { subscribeLiveMatch } from '../services/firebase/liveMatchService';
import { LiveMatchSnapshot } from '../types';

export function useSpectatorMatch(matchCode: string) {
    const [match, setMatch] = useState<LiveMatchSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!matchCode) {
            setLoading(false);
            setError('No match code provided');
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeLiveMatch(
            matchCode,
            (updatedMatch) => {
                setMatch(updatedMatch);
                setLoading(false);
                setError(null);
                setIsConnected(true);
            },
            (err) => {
                setError(err);
                setLoading(false);
                setIsConnected(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [matchCode]);

    return { match, loading, error, isConnected };
}
