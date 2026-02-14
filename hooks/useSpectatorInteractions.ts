/**
 * Spectator-side hook for managing viewer identity, alerts, cheers,
 * and viewer count. Works alongside useSpectatorMatch.
 *
 * Usage:
 *   const {
 *     viewerName, setViewerName, isNameSet,
 *     viewerCount, viewers,
 *     sendAlert, canSendAlert, alertCooldownRemaining,
 *     sendCheer, canSendCheer,
 *     cheerCount, cheerBurst,
 *   } = useSpectatorInteractions(matchCode, match);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    registerSpectator,
    sendCheer as sendCheerService,
    sendScoreCorrectionAlert,
    unregisterSpectator,
    updateSpectatorPresence,
} from '../services/firebase/spectatorInteractionService';
import { LiveMatchSnapshot, Score, SpectatorViewer } from '../types';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

const SPECTATOR_NAME_KEY = 'volleytrack-spectator-name';
const SPECTATOR_DEVICE_ID_KEY = 'volleytrack-spectator-device-id';
const ALERT_COOLDOWN_MS = 30_000; // 30 seconds between alerts
const CHEER_COOLDOWN_MS = 3_000; // 3 seconds between cheers
const PRESENCE_HEARTBEAT_MS = 60_000; // 1 minute heartbeat

export function useSpectatorInteractions(matchCode: string, match: LiveMatchSnapshot | null) {
    // Viewer identity
    const [viewerName, setViewerNameState] = useState<string>('');
    const [deviceId, setDeviceId] = useState<string>('');
    const [isNameSet, setIsNameSet] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    // Alert cooldown
    const [lastAlertSent, setLastAlertSent] = useState<number>(0);
    const [alertCooldownRemaining, setAlertCooldownRemaining] = useState(0);

    // Cheer state
    const [lastCheerSent, setLastCheerSent] = useState<number>(0);
    const [cheerBurst, setCheerBurst] = useState(false);
    const prevCheerCountRef = useRef<number>(0);

    // Initialize device ID and stored name
    useEffect(() => {
        const init = async () => {
            // Get or create device ID
            let storedDeviceId = await AsyncStorage.getItem(SPECTATOR_DEVICE_ID_KEY);
            if (!storedDeviceId) {
                storedDeviceId = `spec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await AsyncStorage.setItem(SPECTATOR_DEVICE_ID_KEY, storedDeviceId);
            }
            setDeviceId(storedDeviceId);

            // Get stored name
            const storedName = await AsyncStorage.getItem(SPECTATOR_NAME_KEY);
            if (storedName) {
                setViewerNameState(storedName);
                setIsNameSet(true);
            }
        };
        init();
    }, []);

    // Set viewer name (persists to AsyncStorage)
    const setViewerName = useCallback(async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        await AsyncStorage.setItem(SPECTATOR_NAME_KEY, trimmed);
        setViewerNameState(trimmed);
        setIsNameSet(true);

        // Re-register with new name if already registered
        if (matchCode && deviceId) {
            registerSpectator(matchCode, deviceId, trimmed);
        }
    }, [matchCode, deviceId]);

    // Register on mount when we have both matchCode and deviceId
    useEffect(() => {
        if (!matchCode || !deviceId || !match?.isActive) return;

        const name = viewerName || 'Fan';
        registerSpectator(matchCode, deviceId, name).then(result => {
            if (result.success) setIsRegistered(true);
        });

        // Heartbeat for presence
        const heartbeat = setInterval(() => {
            updateSpectatorPresence(matchCode, deviceId);
        }, PRESENCE_HEARTBEAT_MS);

        // Cleanup on unmount
        return () => {
            clearInterval(heartbeat);
            unregisterSpectator(matchCode, deviceId);
        };
    }, [matchCode, deviceId, match?.isActive]);

    // Alert cooldown timer
    useEffect(() => {
        if (lastAlertSent === 0) return;

        const tick = () => {
            const remaining = Math.max(0, ALERT_COOLDOWN_MS - (Date.now() - lastAlertSent));
            setAlertCooldownRemaining(remaining);
            if (remaining <= 0) return;
            requestAnimationFrame(tick);
        };

        const timer = setTimeout(tick, 100);
        return () => clearTimeout(timer);
    }, [lastAlertSent]);

    // Detect cheer bursts from other spectators
    useEffect(() => {
        const currentCheerCount = match?.cheerCount || 0;
        if (currentCheerCount > prevCheerCountRef.current && prevCheerCountRef.current > 0) {
            // Someone cheered! Show burst animation
            setCheerBurst(true);
            setTimeout(() => setCheerBurst(false), 1500);
        }
        prevCheerCountRef.current = currentCheerCount;
    }, [match?.cheerCount]);

    // Send score correction alert
    const sendAlert = useCallback(async (suggestedScore?: Score, message?: string) => {
        if (!matchCode || !deviceId) return false;

        const now = Date.now();
        if (now - lastAlertSent < ALERT_COOLDOWN_MS) return false;

        const result = await sendScoreCorrectionAlert(matchCode, {
            type: 'score_correction',
            senderDeviceId: deviceId,
            senderName: viewerName || 'A spectator',
            suggestedScore,
            currentSet: match?.currentState?.currentSet,
            message,
        });

        if (result.success) {
            setLastAlertSent(now);
            setAlertCooldownRemaining(ALERT_COOLDOWN_MS);
        }

        return result.success;
    }, [matchCode, deviceId, viewerName, lastAlertSent, match?.currentState?.currentSet]);

    const canSendAlert = Date.now() - lastAlertSent >= ALERT_COOLDOWN_MS;

    // Send cheer
    const sendCheerAction = useCallback(async () => {
        if (!matchCode) return false;

        const now = Date.now();
        if (now - lastCheerSent < CHEER_COOLDOWN_MS) return false;

        const result = await sendCheerService(matchCode);
        if (result.success) {
            setLastCheerSent(now);
        }
        return result.success;
    }, [matchCode, lastCheerSent]);

    const canSendCheer = Date.now() - lastCheerSent >= CHEER_COOLDOWN_MS;

    // Derived viewer data
    const viewers: SpectatorViewer[] = match?.spectators
        ? Object.values(match.spectators)
        : [];
    const viewerCount = viewers.length;
    const cheerCount = match?.cheerCount || 0;

    return {
        // Identity
        viewerName,
        setViewerName,
        isNameSet,
        deviceId,

        // Viewers
        viewerCount,
        viewers,

        // Alerts
        sendAlert,
        canSendAlert,
        alertCooldownRemaining,

        // Cheers
        sendCheer: sendCheerAction,
        canSendCheer,
        cheerCount,
        cheerBurst,
    };
}
