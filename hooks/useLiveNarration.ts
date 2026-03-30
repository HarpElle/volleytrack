/**
 * useLiveNarration — React Hook for Live Narration Mode
 * =====================================================
 * Manages the full lifecycle of a live narration session:
 *   - Session open/close
 *   - Stat accumulation from Gemini Live function calls
 *   - Microphone permissions
 *   - Commit to useMatchStore (same pattern as useVoiceInput.commitAll)
 *   - Free-tier enforcement
 *
 * The public API mirrors useVoiceInput where it overlaps so
 * LiveNarrationOverlay can use the same patterns as VoiceInputOverlay.
 */

import { Audio } from 'expo-av';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useMatchStore } from '../store/useMatchStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { StatLog } from '../types';
import {
  LiveNarrationCallbacks,
  LiveNarrationService,
  LiveNarrationStatus,
  LiveStatEvent,
} from '../services/ai/LiveNarrationService';

export type { LiveStatEvent };

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveNarrationPhase =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'confirming'  // session stopped, reviewing accumulated stats
  | 'error';

// ── Hook ──────────────────────────────────────────────────────────────────────

const liveNarrationService = new LiveNarrationService();

export function useLiveNarration() {
  const [phase, setPhase] = useState<LiveNarrationPhase>('idle');
  const [stats, setStats] = useState<LiveStatEvent[]>([]);
  const [meteringLevel, setMeteringLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(0);

  // ── Start Session ──────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setError(null);
    setStats([]);

    // Free-tier check
    const matchId = useMatchStore.getState().matchId;
    if (matchId && !useSubscriptionStore.getState().canUseVoiceInput(matchId)) {
      const remaining = useSubscriptionStore.getState().getRemainingVoiceMatches();
      setError(
        remaining <= 0
          ? "You've used voice input in all 3 free matches. Upgrade to Pro for unlimited voice input!"
          : 'Voice input is not available for this match.',
      );
      return;
    }

    // Microphone permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission is required for Live Narrate.');
      return;
    }

    // Gather match context from store
    const matchState = useMatchStore.getState();
    const {
      servingTeam, rallyState, scores, currentSet,
      myTeamName, myTeamRoster, currentRotation,
    } = matchState;

    const currentScore = scores[currentSet - 1] || { myTeam: 0, opponent: 0 };

    const callbacks: LiveNarrationCallbacks = {
      onStatusChange: (status: LiveNarrationStatus) => {
        setPhase(
          status === 'streaming' ? 'streaming'
          : status === 'connecting' ? 'connecting'
          : status === 'reconnecting' ? 'reconnecting'
          : status === 'error' ? 'error'
          : 'idle',
        );
      },
      onStatDetected: (stat: LiveStatEvent) => {
        setStats((prev) => [...prev, stat]);
      },
      onError: (message: string) => {
        setError(message);
        setPhase('error');
      },
      onMeteringUpdate: setMeteringLevel,
    };

    try {
      await liveNarrationService.startSession(
        {
          roster: myTeamRoster || [],
          servingTeam,
          rallyState,
          currentScore,
          myTeamName,
          currentRotation: currentRotation || [],
        },
        callbacks,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to start Live Narrate. Please try again.');
      setPhase('error');
    }
  }, []);

  // ── End Session (rally over, go to review) ─────────────────────────────────

  const endSession = useCallback(() => {
    liveNarrationService.stopSession();
    setMeteringLevel(0);
    setPhase('confirming');
  }, []);

  // ── Cancel (discard everything) ────────────────────────────────────────────

  const cancelSession = useCallback(() => {
    liveNarrationService.stopSession();
    setStats([]);
    setMeteringLevel(0);
    setError(null);
    setPhase('idle');
  }, []);

  // ── Remove a stat from the review list ────────────────────────────────────

  const removeStat = useCallback((index: number) => {
    setStats((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Commit all stats to match store ───────────────────────────────────────
  // Same pattern as useVoiceInput.commitAll() — sequential recordStat calls with undo rollback

  const commitAll = useCallback(async (): Promise<boolean> => {
    if (stats.length === 0) return false;

    committedRef.current = 0;

    try {
      for (const stat of stats) {
        const { recordStat } = useMatchStore.getState();
        const metadata: Record<string, unknown> = { voiceInput: true, liveNarration: true };
        if (stat.assistPlayerId) metadata.assistPlayerId = stat.assistPlayerId;

        recordStat(
          stat.type as StatLog['type'],
          stat.team,
          stat.playerId ?? undefined,
          metadata,
        );
        committedRef.current++;
      }

      // Register match as voice-enabled for free-tier tracking
      const matchId = useMatchStore.getState().matchId;
      if (matchId) {
        useSubscriptionStore.getState().registerVoiceMatch(matchId);
      }

      setPhase('idle');
      setStats([]);
      return true;
    } catch (err: any) {
      console.error('Live narration commit failed after', committedRef.current, 'stats:', err);

      // Rollback in reverse
      const { undo } = useMatchStore.getState();
      for (let i = 0; i < committedRef.current; i++) {
        undo();
      }

      Alert.alert(
        'Commit Failed',
        `Error after logging ${committedRef.current} stat(s). All changes rolled back.`,
        [{ text: 'OK' }],
      );
      return false;
    }
  }, [stats]);

  return {
    // State
    phase,
    stats,
    meteringLevel,
    error,
    // Actions
    startSession,
    endSession,
    cancelSession,
    removeStat,
    commitAll,
  };
}
