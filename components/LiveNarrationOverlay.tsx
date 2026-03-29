/**
 * LiveNarrationOverlay — Real-Time Stat Streaming UI
 * ===================================================
 * Displays the live narration session with real-time stat accumulation.
 * Shows stats as they are detected by Gemini Live, not just at the end.
 *
 * Phase: streaming → waveform + live stat cards + "End Rally" button
 * Phase: confirming → review + remove + "Commit" or "Discard"
 * Phase: error → error message + fallback suggestion
 */

import { CheckCheck, Mic, Radio, RefreshCw, X, Zap } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LIVE_NARRATION_COLORS } from '../constants/voice';
import { useAppTheme } from '../contexts/ThemeContext';
import { LiveNarrationPhase, LiveStatEvent } from '../hooks/useLiveNarration';
import { ParsedVoiceAction } from '../services/ai/VoiceParsingService';
import { VoiceActionCard } from './VoiceActionCard';

interface LiveNarrationOverlayProps {
  visible: boolean;
  phase: LiveNarrationPhase;
  stats: LiveStatEvent[];           // Accumulates in real-time during streaming
  meteringLevel: number;            // 0–100, drives waveform animation
  error: string | null;
  onEndRally: () => void;           // Stop streaming → go to confirming
  onCancel: () => void;             // Discard all, close
  onRemoveStat: (index: number) => void;
  onCommit: () => Promise<boolean>;
  onFallbackToTapMode?: () => void; // Shown in error state as escape hatch
}

export function LiveNarrationOverlay({
  visible,
  phase,
  stats,
  meteringLevel,
  error,
  onEndRally,
  onCancel,
  onRemoveStat,
  onCommit,
  onFallbackToTapMode,
}: LiveNarrationOverlayProps) {
  const { colors, radius } = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isCommitting, setIsCommitting] = React.useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom as new stats appear
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [stats.length]);

  // Recording indicator pulse animation
  useEffect(() => {
    if (phase === 'streaming') {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true, easing: Easing.ease }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.ease }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase, pulseAnim]);

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      await onCommit();
    } finally {
      setIsCommitting(false);
    }
  };

  const isStreaming = phase === 'streaming' || phase === 'connecting' || phase === 'reconnecting';
  const statusLabel =
    phase === 'connecting' ? 'Connecting...'
    : phase === 'reconnecting' ? 'Reconnecting...'
    : phase === 'streaming' ? 'Live — Narrate the rally'
    : phase === 'confirming' ? 'Review Stats'
    : 'Error';

  // Adapt LiveStatEvent → ParsedVoiceAction shape for VoiceActionCard reuse
  const adaptedStats: ParsedVoiceAction[] = stats.map((s) => ({
    type: s.type as ParsedVoiceAction['type'],
    team: s.team,
    playerId: s.playerId ?? undefined,
    playerLabel: s.playerLabel,
    assistPlayerId: s.assistPlayerId ?? undefined,
    assistPlayerLabel: s.assistPlayerLabel,
    confidence: s.confidence,
    rawFragment: s.rawFragment,
  }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
        <View style={[styles.card, { backgroundColor: colors.bg, borderRadius: radius.xl }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {isStreaming && (
                <Animated.View style={[styles.recordDot, { opacity: pulseAnim }]}>
                  <View style={[styles.recordDotInner, { backgroundColor: LIVE_NARRATION_COLORS.streaming }]} />
                </Animated.View>
              )}
              <Text style={[styles.phaseTitle, { color: colors.text }]}>
                {statusLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Subtitle ── */}
          <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
            {isStreaming
              ? `${stats.length} stat${stats.length !== 1 ? 's' : ''} detected`
              : `${stats.length} stat${stats.length !== 1 ? 's' : ''} to review`}
          </Text>

          {/* ── Waveform (streaming only) ── */}
          {isStreaming && (
            <View style={[styles.waveformContainer, { backgroundColor: colors.bgCard, borderRadius: radius.md }]}>
              <WaveformBars meteringLevel={meteringLevel} color={LIVE_NARRATION_COLORS.streaming} />
              <Text style={[styles.waveformHint, { color: colors.textTertiary }]}>
                Speak naturally — stats appear as you narrate
              </Text>
            </View>
          )}

          {/* ── Live Stat Cards (appear in real-time) ── */}
          {stats.length > 0 && (
            <ScrollView
              ref={scrollRef}
              style={styles.statList}
              showsVerticalScrollIndicator={false}
            >
              {adaptedStats.map((stat, index) => (
                <VoiceActionCard
                  key={`live-stat-${index}`}
                  action={stat}
                  index={index}
                  onRemove={onRemoveStat}
                />
              ))}
            </ScrollView>
          )}

          {/* ── Empty state during streaming ── */}
          {stats.length === 0 && isStreaming && (
            <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderRadius: radius.md }]}>
              <Zap size={20} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                Narrate the rally — stats will appear here instantly
              </Text>
            </View>
          )}

          {/* ── Error display ── */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderRadius: radius.md }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              {phase === 'error' && onFallbackToTapMode && (
                <TouchableOpacity onPress={onFallbackToTapMode} style={styles.fallbackBtn}>
                  <Mic size={14} color={colors.textSecondary} />
                  <Text style={[styles.errorHint, { color: colors.textSecondary }]}>
                    Switch to tap mode instead
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Buttons ── */}
          {isStreaming && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}
                onPress={onCancel}
              >
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: LIVE_NARRATION_COLORS.streaming, borderRadius: radius.lg }]}
                onPress={onEndRally}
              >
                <Radio size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>End Rally</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'confirming' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.bgCard, borderRadius: radius.lg }]}
                onPress={onCancel}
              >
                <RefreshCw size={16} color={colors.textSecondary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: LIVE_NARRATION_COLORS.statAppear,
                    opacity: stats.length === 0 || isCommitting ? 0.5 : 1,
                    borderRadius: radius.lg,
                  },
                ]}
                onPress={handleCommit}
                disabled={stats.length === 0 || isCommitting}
              >
                {isCommitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCheck size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Commit {stats.length}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Waveform Component ────────────────────────────────────────────────────────

function WaveformBars({ meteringLevel, color }: { meteringLevel: number; color: string }) {
  const BAR_COUNT = 20;
  return (
    <View style={styles.waveformBars}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const centerDist = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
        const scale = (meteringLevel / 100) * (1 - centerDist * 0.5);
        const height = Math.max(4, scale * 40);
        return (
          <View
            key={i}
            style={[
              styles.waveformBar,
              { height, backgroundColor: color, opacity: 0.7 + scale * 0.3 },
            ]}
          />
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    padding: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: { padding: 4 },
  recordDot: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  recordDotInner: { width: 8, height: 8, borderRadius: 4 },
  phaseTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  phaseSubtitle: { fontSize: 13, marginTop: -6 },
  waveformContainer: { padding: 12, alignItems: 'center', gap: 8 },
  waveformBars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 44 },
  waveformBar: { width: 4, borderRadius: 2 },
  waveformHint: { fontSize: 11, textAlign: 'center' },
  statList: { maxHeight: 260 },
  emptyState: { padding: 20, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  errorBox: { padding: 12, gap: 4 },
  errorText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorHint: { fontSize: 12, textAlign: 'center' },
  fallbackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
