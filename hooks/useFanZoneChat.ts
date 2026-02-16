/**
 * useFanZoneChat — Hook for spectator-to-spectator chat.
 *
 * Subscribes to the chat subcollection in real-time, manages send cooldowns,
 * and provides quick-reaction helpers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    sendChatMessage,
    subscribeToChatMessages,
} from '../services/firebase/spectatorChatService';
import { SpectatorChatMessage } from '../types';

const SEND_COOLDOWN_MS = 5_000; // 5 seconds between messages
const MAX_MESSAGE_LENGTH = 200;

interface QuickReaction {
    key: string;
    emoji: string;
    text: string;
}

export const QUICK_REACTIONS: QuickReaction[] = [
    { key: 'clap', emoji: '👏', text: '👏👏👏' },
    { key: 'fire', emoji: '🔥', text: '🔥🔥🔥' },
    { key: 'heart', emoji: '❤️', text: '❤️' },
    { key: 'volleyball', emoji: '🏐', text: '🏐' },
    { key: 'flex', emoji: '💪', text: "Let's go!" },
    { key: 'lfg', emoji: '🗣️', text: 'LET\'S GOOO!' },
];

export function useFanZoneChat(
    matchCode: string,
    deviceId: string,
    senderName: string
) {
    const [messages, setMessages] = useState<SpectatorChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSentAt, setLastSentAt] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const prevMessageCountRef = useRef(0);

    // Subscribe to chat messages
    useEffect(() => {
        if (!matchCode) return;

        const unsubscribe = subscribeToChatMessages(matchCode, (newMessages) => {
            setMessages(newMessages);
            setIsLoading(false);

            // Track unread when modal is closed
            if (!isOpen && newMessages.length > prevMessageCountRef.current) {
                const newCount = newMessages.length - prevMessageCountRef.current;
                setUnreadCount(prev => prev + newCount);
            }
            prevMessageCountRef.current = newMessages.length;
        });

        return () => unsubscribe();
    }, [matchCode, isOpen]);

    // Reset unread count when modal opens
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    const canSend = Date.now() - lastSentAt >= SEND_COOLDOWN_MS;
    const cooldownRemaining = Math.max(0, SEND_COOLDOWN_MS - (Date.now() - lastSentAt));

    // Send a text message
    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!trimmed || !matchCode || !deviceId || !canSend) return false;

        const result = await sendChatMessage(matchCode, deviceId, senderName, trimmed);
        if (result.success) {
            setLastSentAt(Date.now());
        }
        return result.success;
    }, [matchCode, deviceId, senderName, canSend]);

    // Send a quick reaction
    const sendQuickReaction = useCallback(async (reactionKey: string) => {
        const reaction = QUICK_REACTIONS.find(r => r.key === reactionKey);
        if (!reaction || !canSend) return false;
        return sendMessage(reaction.text);
    }, [sendMessage, canSend]);

    return {
        messages,
        isLoading,
        canSend,
        cooldownRemaining,
        unreadCount,
        isOpen,
        setIsOpen,
        sendMessage,
        sendQuickReaction,
    };
}
