import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { StatLog, Team } from '../types';

// Stat types that end a rally and award a point
const POINT_SCORERS = ['ace', 'kill', 'block'];
const POINT_ERRORS = ['serve_error', 'attack_error', 'dig_error', 'set_error', 'pass_error', 'receive_0', 'drop'];

function isRallyEnding(type: string): boolean {
    return POINT_SCORERS.includes(type) || POINT_ERRORS.includes(type);
}

function getScoringTeam(event: StatLog): Team | null {
    if (!isRallyEnding(event.type)) return null;
    if (POINT_ERRORS.includes(event.type)) {
        return event.team === 'myTeam' ? 'opponent' : 'myTeam';
    }
    return event.team;
}

interface UseMatchSoundsOptions {
    /** Whether haptic feedback is enabled (default true) */
    hapticsEnabled?: boolean;
}

/**
 * Provides haptic feedback for key game moments.
 *
 * Sound effects are intentionally NOT included — parents watching from the
 * bleachers would find unexpected sounds annoying. Haptics are subtle and
 * personal, so they default to ON.
 *
 * Feedback patterns:
 * - Point scored by myTeam: light impact
 * - Point scored by opponent: soft notification
 * - Timeout: medium impact
 * - Set won by myTeam: success notification
 * - Set won by opponent: warning notification
 * - Big play (ace/kill/block by myTeam): heavy impact
 */
export function useMatchSounds(options?: UseMatchSoundsOptions) {
    const hapticsEnabled = options?.hapticsEnabled ?? true;
    const prevHistoryLenRef = useRef(0);

    /** Fire haptic for a specific game event */
    const triggerHaptic = useCallback(async (type: 'point_my' | 'point_opp' | 'timeout' | 'set_won' | 'set_lost' | 'big_play') => {
        if (!hapticsEnabled) return;

        try {
            switch (type) {
                case 'point_my':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'point_opp':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    break;
                case 'timeout':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'set_won':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                case 'set_lost':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    break;
                case 'big_play':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
            }
        } catch {
            // Silently fail — haptics may not be available on all devices
        }
    }, [hapticsEnabled]);

    /**
     * Process new history events and fire appropriate haptics.
     * Call this from a useEffect watching history length.
     */
    const processNewEvents = useCallback((history: StatLog[]) => {
        if (!hapticsEnabled || !history) return;

        const histLen = history.length;
        if (histLen <= prevHistoryLenRef.current) {
            prevHistoryLenRef.current = histLen;
            return;
        }

        const newEvents = history.slice(prevHistoryLenRef.current);
        prevHistoryLenRef.current = histLen;

        for (const event of newEvents) {
            if (event.type === 'timeout') {
                triggerHaptic('timeout');
                continue;
            }

            if (!isRallyEnding(event.type)) continue;

            const scorer = getScoringTeam(event);
            if (!scorer) continue;

            // Big play haptic for aces, kills, blocks by myTeam
            if (scorer === 'myTeam' && POINT_SCORERS.includes(event.type)) {
                triggerHaptic('big_play');
            } else if (scorer === 'myTeam') {
                triggerHaptic('point_my');
            } else {
                triggerHaptic('point_opp');
            }
        }
    }, [hapticsEnabled, triggerHaptic]);

    return {
        triggerHaptic,
        processNewEvents,
        prevHistoryLenRef,
    };
}
