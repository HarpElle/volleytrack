/**
 * Spectator Interaction Service
 *
 * Handles spectator-to-coach alerts, viewer presence tracking, and cheer reactions.
 * All data is embedded in the existing liveMatches/{matchCode} Firestore document
 * to leverage the existing onSnapshot listeners on both sides.
 *
 * Write strategies (conflict-free):
 *   - Viewers: setDoc with merge on nested map key (spectators.{deviceId})
 *   - Alerts: arrayUnion on spectatorAlerts field
 *   - Cheers: increment() on cheerCount field
 */

import {
    addDoc,
    arrayUnion,
    collection,
    deleteField,
    doc,
    increment,
    updateDoc,
} from 'firebase/firestore';
import { SpectatorAlert, SpectatorViewer } from '../../types';
import { db } from './config';

const MAX_ALERTS = 20;

/**
 * Register a spectator viewer in the live match document.
 * Each viewer writes to their own key in the `spectators` map — no conflicts.
 */
export async function registerSpectator(
    matchCode: string,
    deviceId: string,
    name: string,
    cheeringFor: string[] = []
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        const viewer: SpectatorViewer = {
            deviceId,
            name: name || 'Fan',
            cheeringFor,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
        };

        await updateDoc(docRef, {
            [`spectators.${deviceId}`]: viewer,
            spectatorCount: increment(1),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to register viewer' };
    }
}

/**
 * Update a spectator's lastSeen timestamp (heartbeat).
 */
export async function updateSpectatorPresence(
    matchCode: string,
    deviceId: string
): Promise<void> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, {
            [`spectators.${deviceId}.lastSeen`]: Date.now(),
        });
    } catch (_) {
        // Best-effort — don't throw on heartbeat failures
    }
}

/**
 * Unregister a spectator when they leave the match.
 */
export async function unregisterSpectator(
    matchCode: string,
    deviceId: string
): Promise<void> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, {
            [`spectators.${deviceId}`]: deleteField(),
            spectatorCount: increment(-1),
        });
    } catch (_) {
        // Best-effort cleanup
    }
}

/**
 * Send a spectator alert (score correction, emergency, etc.) to the coach.
 * Uses arrayUnion for conflict-free appends.
 */
export async function sendSpectatorAlert(
    matchCode: string,
    alert: Omit<SpectatorAlert, 'id' | 'timestamp' | 'acknowledged'>
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        const fullAlert: SpectatorAlert = {
            ...alert,
            id: `alert_${Date.now()}_${alert.senderDeviceId.slice(0, 6)}`,
            timestamp: Date.now(),
            acknowledged: false,
        };

        await updateDoc(docRef, {
            spectatorAlerts: arrayUnion(fullAlert),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send alert' };
    }
}

/**
 * Send a cheer reaction. Increments cheerCount atomically.
 */
export async function sendCheer(
    matchCode: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        await updateDoc(docRef, {
            cheerCount: increment(1),
            lastCheerAt: Date.now(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send cheer' };
    }
}

/**
 * Coach-side: Acknowledge (mark as seen) all current alerts.
 * Replaces the alerts array with acknowledged versions.
 */
export async function acknowledgeAlerts(
    matchCode: string,
    alerts: SpectatorAlert[]
): Promise<void> {
    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        const acknowledged = alerts.map(a => ({ ...a, acknowledged: true }));
        await updateDoc(docRef, {
            spectatorAlerts: acknowledged,
        });
    } catch (_) {
        // Best-effort
    }
}

/**
 * Coach-side: Trim old alerts to keep the document lean.
 * Called periodically or when alerts exceed MAX_ALERTS.
 */
export async function trimAlerts(
    matchCode: string,
    currentAlerts: SpectatorAlert[]
): Promise<void> {
    if (currentAlerts.length <= MAX_ALERTS) return;

    try {
        const docRef = doc(db, 'liveMatches', matchCode);
        const trimmed = currentAlerts.slice(-MAX_ALERTS);
        await updateDoc(docRef, {
            spectatorAlerts: trimmed,
        });
    } catch (_) {
        // Best-effort
    }
}
/**
 * Send a floating reaction (e.g. 'fire', 'clap', 'heart', 'ball').
 * Writes to a 'reactions' sub-collection to allow high throughput without
 * contention on the main document.
 */

export async function sendReaction(
    matchCode: string,
    reactionType: string,
    senderId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const reactionsRef = collection(db, 'liveMatches', matchCode, 'reactions');
        await addDoc(reactionsRef, {
            type: reactionType,
            senderId,
            timestamp: Date.now(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send reaction' };
    }
}

/**
 * Send a cheer pulse (audio/tap intensity) to the match.
 * Writes to 'reactions' collection with type 'cheer_pulse'.
 */
export async function sendCheerPulse(
    matchCode: string,
    senderId: string,
    intensity: number // 0-100
): Promise<{ success: boolean; error?: string }> {
    try {
        const reactionsRef = collection(db, 'liveMatches', matchCode, 'reactions');
        await addDoc(reactionsRef, {
            type: 'cheer_pulse',
            senderId,
            intensity,
            timestamp: Date.now(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send cheer pulse' };
    }
}
