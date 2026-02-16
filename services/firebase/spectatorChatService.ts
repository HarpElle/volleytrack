/**
 * Spectator Chat Service
 *
 * Manages the Fan Zone chat subcollection at liveMatches/{matchCode}/chat.
 * Follows the same pattern as the reactions subcollection — high-throughput
 * writes to a subcollection rather than the main document.
 */

import {
    addDoc,
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';
import { SpectatorChatMessage } from '../../types';
import { db } from './config';

/**
 * Send a chat message to the Fan Zone.
 */
export async function sendChatMessage(
    matchCode: string,
    deviceId: string,
    senderName: string,
    text: string,
    type: SpectatorChatMessage['type'] = 'message',
    extra?: { triggerEvent?: string; triggerPlayerName?: string; linkedStatId?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const chatRef = collection(db, 'liveMatches', matchCode, 'chat');
        await addDoc(chatRef, {
            senderDeviceId: deviceId,
            senderName,
            text,
            type,
            timestamp: Date.now(),
            ...(extra?.triggerEvent && { triggerEvent: extra.triggerEvent }),
            ...(extra?.triggerPlayerName && { triggerPlayerName: extra.triggerPlayerName }),
            ...(extra?.linkedStatId && { linkedStatId: extra.linkedStatId }),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send message' };
    }
}

/**
 * Send an auto-generated celebration message (for aces, kills, blocks).
 */
export async function sendCelebrationMessage(
    matchCode: string,
    eventType: string,
    playerName: string,
    jerseyNumber?: string
): Promise<void> {
    const labels: Record<string, string> = {
        ace: '🎯 ACE',
        kill: '🔥 KILL',
        block: '🧱 STUFF BLOCK',
    };
    const label = labels[eventType] || eventType.toUpperCase();
    const playerTag = jerseyNumber ? `#${jerseyNumber} ${playerName}` : playerName;
    const text = `${label} by ${playerTag}!`;

    try {
        const chatRef = collection(db, 'liveMatches', matchCode, 'chat');
        await addDoc(chatRef, {
            senderDeviceId: 'system',
            senderName: 'VolleyTrack',
            text,
            type: 'celebration',
            timestamp: Date.now(),
            triggerEvent: eventType,
            triggerPlayerName: playerName,
        });
    } catch (_) {
        // Best-effort — don't throw on celebration failures
    }
}

/**
 * Subscribe to live chat messages.
 * Returns an unsubscribe function.
 */
export function subscribeToChatMessages(
    matchCode: string,
    callback: (messages: SpectatorChatMessage[]) => void,
    messageLimit: number = 50
): () => void {
    const chatRef = collection(db, 'liveMatches', matchCode, 'chat');
    const q = query(chatRef, orderBy('timestamp', 'desc'), limit(messageLimit));

    return onSnapshot(q, (snapshot) => {
        const messages: SpectatorChatMessage[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as SpectatorChatMessage[];

        // Return in chronological order (oldest first) for chat display
        callback(messages.reverse());
    });
}
