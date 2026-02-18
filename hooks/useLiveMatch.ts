/**
 * Coach-side hook for broadcasting live match state to spectators.
 *
 * Usage in live.tsx:
 *   const { isBroadcasting, matchCode, error, startBroadcast, stopBroadcast } = useLiveMatch();
 *
 * When broadcasting is active, the hook subscribes to Zustand store changes
 * and pushes state updates to Firestore (throttled to max 1/second).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../services/firebase';
import {
    startLiveMatch,
    updateLiveMatch,
    stopLiveMatch as stopLiveMatchService,
    subscribeInteractions,
    buildSnapshot,
    updateBroadcastSettings,
} from '../services/firebase/liveMatchService';
import { acknowledgeAlerts } from '../services/firebase/spectatorInteractionService';
import { useMatchStore } from '../store/useMatchStore';
import { SpectatorAlert } from '../types';
import { logger } from '../utils/logger';

const THROTTLE_MS = 1000; // Max 1 push per second

export function useLiveMatch() {
    const { user } = useAuth();
    const [matchCode, setMatchCode] = useState<string | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    // Broadcast settings
    const [broadcastSettings, setBroadcastSettings] = useState<{ allowSpectatorAlerts: boolean }>({ allowSpectatorAlerts: true });
    const broadcastSettingsRef = useRef(broadcastSettings);
    useEffect(() => { broadcastSettingsRef.current = broadcastSettings; }, [broadcastSettings]);

    // Spectator alert tracking (coach-side)
    const [pendingAlerts, setPendingAlerts] = useState<SpectatorAlert[]>([]);
    const [viewerCount, setViewerCount] = useState(0);
    const seenAlertIdsRef = useRef<Set<string>>(new Set());

    // Refs for throttling
    const lastPushRef = useRef<number>(0);
    const pendingPushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const broadcastingRef = useRef(false); // Avoid stale closures in subscriber
    const matchCodeRef = useRef<string | null>(null);

    // Keep refs in sync with state
    useEffect(() => {
        broadcastingRef.current = isBroadcasting;
    }, [isBroadcasting]);

    useEffect(() => {
        matchCodeRef.current = matchCode;
    }, [matchCode]);

    /**
     * Push current state to Firestore (throttled)
     */
    const pushUpdate = useCallback((status: 'live' | 'between-sets' | 'completed' = 'live') => {
        if (!broadcastingRef.current || !matchCodeRef.current || !user?.uid) return;

        const now = Date.now();
        const elapsed = now - lastPushRef.current;

        const doPush = () => {
            const state = useMatchStore.getState();
            lastPushRef.current = Date.now();
            updateLiveMatch(matchCodeRef.current!, user.uid, state, status).then(result => {
                if (!result.success) {
                    setError(result.error || 'Push failed');
                }
            }).catch((err) => logger.warn('[LiveMatch]', err));
        };

        // If enough time has passed, push immediately
        if (elapsed >= THROTTLE_MS) {
            doPush();
        } else {
            // Otherwise, schedule a deferred push (replace any pending one)
            if (pendingPushRef.current) clearTimeout(pendingPushRef.current);
            pendingPushRef.current = setTimeout(doPush, THROTTLE_MS - elapsed);
        }
    }, [user?.uid]);

    /**
     * Subscribe to store changes when broadcasting
     */
    useEffect(() => {
        if (!isBroadcasting) return;

        // Subscribe to any state changes in the match store
        const unsubscribe = useMatchStore.subscribe((state, prevState) => {
            // Only push if meaningful match data changed
            const changed =
                state.scores !== prevState.scores ||
                state.currentSet !== prevState.currentSet ||
                state.setsWon !== prevState.setsWon ||
                state.currentRotation !== prevState.currentRotation ||
                state.servingTeam !== prevState.servingTeam ||
                state.history !== prevState.history ||
                state.timeoutsRemaining !== prevState.timeoutsRemaining ||
                state.subsRemaining !== prevState.subsRemaining ||
                state.setHistory !== prevState.setHistory ||
                state.rallyState !== prevState.rallyState;

            if (changed) {
                pushUpdate('live');
            }
        });

        return () => {
            unsubscribe();
            if (pendingPushRef.current) clearTimeout(pendingPushRef.current);
        };
    }, [isBroadcasting, pushUpdate]);

    /**
     * Subscribe to the interactions subdoc for spectator alerts & viewer count.
     * This is a SEPARATE document from the match state, so spectator writes
     * (presence, cheers, alerts) don't contend with the coach's state pushes.
     */
    useEffect(() => {
        if (!isBroadcasting || !matchCode) return;

        // Throttle processing of interactions updates (coach doesn't need real-time)
        let lastProcessed = 0;
        const INTERACTIONS_THROTTLE_MS = 5000; // Process at most once every 5 seconds
        let pendingData: any = null;
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;

        const processInteractions = (data: any) => {
            // Always update viewer count
            const spectators = data.spectators || {};
            setViewerCount(Object.keys(spectators).length);

            // Only process alerts if coach has them enabled
            if (!broadcastSettingsRef.current.allowSpectatorAlerts) return;

            const alerts = data.spectatorAlerts || [];
            const newAlerts = alerts.filter(
                (a: SpectatorAlert) => !a.acknowledged && !seenAlertIdsRef.current.has(a.id)
            );

            if (newAlerts.length > 0) {
                setPendingAlerts(prev => [...prev, ...newAlerts]);
                newAlerts.forEach((a: SpectatorAlert) => seenAlertIdsRef.current.add(a.id));
            }
        };

        const unsubscribe = subscribeInteractions(
            matchCode,
            (data) => {
                const now = Date.now();
                if (now - lastProcessed >= INTERACTIONS_THROTTLE_MS) {
                    lastProcessed = now;
                    processInteractions(data);
                } else {
                    // Defer processing
                    pendingData = data;
                    if (!throttleTimer) {
                        throttleTimer = setTimeout(() => {
                            throttleTimer = null;
                            if (pendingData) {
                                lastProcessed = Date.now();
                                processInteractions(pendingData);
                                pendingData = null;
                            }
                        }, INTERACTIONS_THROTTLE_MS - (now - lastProcessed));
                    }
                }
            },
            (_err) => {
                // Silently handle — coach is still writing, so connection should be fine
            }
        );

        return () => {
            unsubscribe();
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [isBroadcasting, matchCode]);

    /**
     * Dismiss a specific alert (coach has seen it)
     */
    const dismissAlert = useCallback((alertId: string) => {
        setPendingAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    /**
     * Dismiss all pending alerts
     */
    const dismissAllAlerts = useCallback(() => {
        if (matchCode && pendingAlerts.length > 0) {
            // Mark as acknowledged in Firestore (best-effort)
            acknowledgeAlerts(matchCode, pendingAlerts).catch((err) => logger.warn('[LiveMatch] acknowledgeAlerts:', err));
        }
        setPendingAlerts([]);
    }, [matchCode, pendingAlerts]);

    /**
     * Start broadcasting the current match
     */
    const startBroadcast = useCallback(async (): Promise<string | null> => {
        if (!user?.uid) {
            setError('Sign in to share your match');
            return null;
        }

        setIsStarting(true);
        setError(null);

        const state = useMatchStore.getState();
        const result = await startLiveMatch(user.uid, state.matchId, state);

        setIsStarting(false);

        if (result.success) {
            setMatchCode(result.matchCode);
            setIsBroadcasting(true);
            setError(null);
            return result.matchCode;
        } else {
            setError(result.error || 'Failed to start sharing');
            return null;
        }
    }, [user?.uid]);

    /**
     * Stop broadcasting
     */
    const stopBroadcast = useCallback(async () => {
        if (!matchCode || !user?.uid) return;

        // Clear any pending push
        if (pendingPushRef.current) clearTimeout(pendingPushRef.current);

        await stopLiveMatchService(matchCode, user.uid);

        setIsBroadcasting(false);
        setMatchCode(null);
        setError(null);
    }, [matchCode, user?.uid]);

    /**
     * Push final state and stop (called on match finalize)
     */
    const finalizeBroadcast = useCallback(async () => {
        if (!broadcastingRef.current || !matchCodeRef.current || !user?.uid) return;

        // Push final state with 'completed' status
        const state = useMatchStore.getState();
        await updateLiveMatch(matchCodeRef.current, user.uid, state, 'completed').catch((err) => logger.warn('[LiveMatch] finalizeBroadcast:', err));

        setIsBroadcasting(false);
        setMatchCode(null);
    }, [user?.uid]);

    /**
     * Toggle spectator alerts on/off
     */
    const toggleAlerts = useCallback(async () => {
        const newValue = !broadcastSettings.allowSpectatorAlerts;
        setBroadcastSettings({ allowSpectatorAlerts: newValue });
        if (matchCode) {
            await updateBroadcastSettings(matchCode, { allowSpectatorAlerts: newValue })
                .catch((err) => logger.warn('[LiveMatch] updateBroadcastSettings:', err));
        }
    }, [broadcastSettings.allowSpectatorAlerts, matchCode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pendingPushRef.current) clearTimeout(pendingPushRef.current);
        };
    }, []);

    return {
        matchCode,
        isBroadcasting,
        isStarting,
        error,
        startBroadcast,
        stopBroadcast,
        finalizeBroadcast,
        pushUpdate,
        // Broadcast settings
        broadcastSettings,
        toggleAlerts,
        // Spectator interactions (coach-side)
        pendingAlerts,
        dismissAlert,
        dismissAllAlerts,
        viewerCount,
    };
}
