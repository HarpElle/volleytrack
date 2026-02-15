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
    sendCheerPulse as sendCheerPulseService,
    sendCheer as sendCheerService,
    sendReaction as sendReactionService,
    sendSpectatorAlert,
    unregisterSpectator,
    updateSpectatorPresence
} from '../services/firebase/spectatorInteractionService';
import { LiveMatchSnapshot, Score, SpectatorViewer } from '../types';

const SPECTATOR_NAME_KEY = 'volleytrack-spectator-name';
const SPECTATOR_DEVICE_ID_KEY = 'volleytrack-spectator-device-id';
const ALERT_COOLDOWN_MS = 30_000; // 30 seconds between alerts
const CHEER_COOLDOWN_MS = 3_000; // 3 seconds between cheers
const PRESENCE_HEARTBEAT_MS = 60_000; // 1 minute heartbeat

export function useSpectatorInteractions(matchCode: string, match: LiveMatchSnapshot | null) {
    // Viewer identity
    const [viewerName, setViewerNameState] = useState<string>('');
    const [cheeringFor, setCheeringForState] = useState<string[]>([]);
    const [deviceId, setDeviceId] = useState<string>('');
    const [isProfileSet, setIsProfileSet] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    // Alert cooldown
    const [lastAlertSent, setLastAlertSent] = useState<number>(0);
    const [alertCooldownRemaining, setAlertCooldownRemaining] = useState(0);

    // Cheer state
    const [lastCheerSent, setLastCheerSent] = useState<number>(0);
    const [cheerBurst, setCheerBurst] = useState(false);
    const prevCheerCountRef = useRef<number>(0);

    // Initialize device ID and stored profile
    useEffect(() => {
        const init = async () => {
            // Get or create device ID
            let storedDeviceId = await AsyncStorage.getItem(SPECTATOR_DEVICE_ID_KEY);
            if (!storedDeviceId) {
                storedDeviceId = `spec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await AsyncStorage.setItem(SPECTATOR_DEVICE_ID_KEY, storedDeviceId);
            }
            setDeviceId(storedDeviceId);

            // Get stored profile
            const storedName = await AsyncStorage.getItem(SPECTATOR_NAME_KEY);
            const storedCheering = await AsyncStorage.getItem('volleytrack-spectator-cheering');

            if (storedName) {
                setViewerNameState(storedName);
                if (storedCheering) {
                    try {
                        setCheeringForState(JSON.parse(storedCheering));
                    } catch (e) {
                        // ignore parse error
                    }
                }
                setIsProfileSet(true);
            }
        };
        init();
    }, []);

    // Join match with name and cheering preferences
    const joinMatch = useCallback(async (name: string, cheering: string[]) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        await AsyncStorage.setItem(SPECTATOR_NAME_KEY, trimmed);
        await AsyncStorage.setItem('volleytrack-spectator-cheering', JSON.stringify(cheering));

        setViewerNameState(trimmed);
        setCheeringForState(cheering);
        setIsProfileSet(true);

        // Register immediately
        if (matchCode && deviceId) {
            registerSpectator(matchCode, deviceId, trimmed, cheering).then(result => {
                if (result.success) setIsRegistered(true);
            });
        }
    }, [matchCode, deviceId]);

    // Register on mount if profile is already set
    useEffect(() => {
        if (!matchCode || !deviceId || !match?.isActive || !isProfileSet) return;

        const name = viewerName || 'Fan';
        registerSpectator(matchCode, deviceId, name, cheeringFor).then(result => {
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
    }, [matchCode, deviceId, match?.isActive, isProfileSet, viewerName, cheeringFor]);

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

    // Send alert (Score Correction, Emergency, etc.)
    const sendAlert = useCallback(async (
        type: 'score_correction' | 'emergency' | 'other',
        payload?: { suggestedScore?: Score; message?: string }
    ) => {
        if (!matchCode || !deviceId) return false;

        const now = Date.now();
        if (now - lastAlertSent < ALERT_COOLDOWN_MS) return false;

        const result = await sendSpectatorAlert(matchCode, {
            type,
            senderDeviceId: deviceId,
            senderName: viewerName || 'A spectator',
            suggestedScore: payload?.suggestedScore,
            currentSet: match?.currentState?.currentSet,
            message: payload?.message,
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

    // Send Reaction (Fire, Clap, etc.)
    const sendReaction = useCallback(async (type: string) => {
        if (!matchCode || !deviceId) return false;
        // No strict cooldown for reactions, maybe a small debounce in UI
        return sendReactionService(matchCode, type, deviceId);
    }, [matchCode, deviceId]);

    // Derived viewer data
    const viewers: SpectatorViewer[] = match?.spectators
        ? Object.values(match.spectators)
        : [];
    const viewerCount = viewers.length;
    const cheerCount = match?.cheerCount || 0;

    const sendCheerLevel = useCallback(async (intensity: number) => {
        if (!matchCode || !deviceId) return;
        // Simple throttle: don't send if we just sent one (component handles main throttle)
        await sendCheerPulseService(matchCode, deviceId, intensity);
    }, [matchCode, deviceId]);

    return {
        // Identity
        viewerName,
        setViewerName: setViewerNameState,
        cheeringFor, // Added
        isProfileSet, // Added
        isNameSet: isProfileSet && !!viewerName,
        isRegistered,
        joinMatch,
        deviceId,

        // Viewers
        viewerCount,
        viewers,

        // Alerts
        sendAlert,
        canSendAlert: alertCooldownRemaining === 0,
        alertCooldownRemaining,

        // Cheers
        sendCheer: sendCheerAction,
        canSendCheer: Date.now() - lastCheerSent > CHEER_COOLDOWN_MS,
        sendCheerLevel, // New
        cheerCount,
        cheerBurst,
        sendReaction,
    };
}
