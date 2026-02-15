import { Check, Mic, MicOff, RefreshCw, X } from 'lucide-react-native';
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
import { VOICE_COLORS } from '../constants/voice';
import { useAppTheme } from '../contexts/ThemeContext';
import { ParsedVoiceAction } from '../services/ai/VoiceParsingService';
import { VoiceInputPhase } from '../hooks/useVoiceInput';
import { VoiceActionCard } from './VoiceActionCard';

// ── Props ────────────────────────────────────────────────────────────────────

interface VoiceInputOverlayProps {
    visible: boolean;
    phase: VoiceInputPhase;
    isListening: boolean;
    liveTranscript: string;
    finalTranscript: string;
    parsedActions: ParsedVoiceAction[];
    isParsing: boolean;
    parseError: string | null;
    error: string | null;

    onStopAndParse: () => void;
    onCancel: () => void;
    onRetry: () => void;
    onRemoveAction: (index: number) => void;
    onCommit: () => Promise<boolean>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function VoiceInputOverlay({
    visible,
    phase,
    isListening,
    liveTranscript,
    finalTranscript,
    parsedActions,
    isParsing,
    parseError,
    error,
    onStopAndParse,
    onCancel,
    onRetry,
    onRemoveAction,
    onCommit,
}: VoiceInputOverlayProps) {
    const { colors, radius } = useAppTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const [isCommitting, setIsCommitting] = React.useState(false);

    // Pulsing animation for mic icon during recording
    useEffect(() => {
        if (isListening) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isListening]);

    const handleCommit = async () => {
        setIsCommitting(true);
        try {
            await onCommit();
        } finally {
            setIsCommitting(false);
        }
    };

    const displayTranscript = finalTranscript || liveTranscript;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay || 'rgba(0,0,0,0.6)' }]}>
                <View style={[styles.card, { backgroundColor: colors.bg, borderRadius: radius.lg || 24 }]}>

                    {/* ── Recording Phase ─────────────────────── */}
                    {phase === 'recording' && (
                        <View style={styles.recordingContainer}>
                            {/* Animated Mic */}
                            <Animated.View style={[
                                styles.micCircle,
                                { backgroundColor: VOICE_COLORS.recording + '20', transform: [{ scale: pulseAnim }] }
                            ]}>
                                <View style={[styles.micInner, { backgroundColor: VOICE_COLORS.recording }]}>
                                    <Mic size={36} color="#ffffff" />
                                </View>
                            </Animated.View>

                            <Text style={[styles.phaseTitle, { color: colors.text }]}>Listening...</Text>
                            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
                                Describe the rally actions
                            </Text>

                            {/* Live transcript preview */}
                            {displayTranscript ? (
                                <View style={[styles.transcriptBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <Text style={[styles.transcriptText, { color: colors.text }]}>
                                        {`\u201C${displayTranscript}\u201D`}
                                    </Text>
                                </View>
                            ) : (
                                <View style={[styles.transcriptBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <Text style={[styles.transcriptPlaceholder, { color: colors.textTertiary }]}>
                                        Speak now...
                                    </Text>
                                </View>
                            )}

                            {/* Error display */}
                            {error && (
                                <Text style={[styles.errorText, { color: VOICE_COLORS.error }]}>{error}</Text>
                            )}

                            {/* Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.secondaryBtn, { backgroundColor: colors.bgCard }]}
                                    onPress={onCancel}
                                >
                                    <X size={18} color={colors.textSecondary} />
                                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: VOICE_COLORS.recording }]}
                                    onPress={onStopAndParse}
                                >
                                    <MicOff size={18} color="#ffffff" />
                                    <Text style={styles.primaryBtnText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ── Parsing Phase ───────────────────────── */}
                    {phase === 'parsing' && (
                        <View style={styles.parsingContainer}>
                            <ActivityIndicator size="large" color={VOICE_COLORS.parsing} />
                            <Text style={[styles.phaseTitle, { color: colors.text, marginTop: 20 }]}>
                                Analyzing...
                            </Text>
                            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
                                Parsing your rally description
                            </Text>

                            {displayTranscript && (
                                <View style={[styles.transcriptBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <Text style={[styles.transcriptText, { color: colors.textSecondary }]}>
                                        {`\u201C${displayTranscript}\u201D`}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.secondaryBtn, { backgroundColor: colors.bgCard, marginTop: 16 }]}
                                onPress={onCancel}
                            >
                                <X size={18} color={colors.textSecondary} />
                                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── Confirming Phase ────────────────────── */}
                    {phase === 'confirming' && (
                        <View style={styles.confirmContainer}>
                            <Text style={[styles.phaseTitle, { color: colors.text }]}>
                                Review Actions
                            </Text>
                            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
                                {parsedActions.length} action{parsedActions.length !== 1 ? 's' : ''} detected
                            </Text>

                            {/* Parse error display */}
                            {parseError && (
                                <Text style={[styles.errorText, { color: VOICE_COLORS.error }]}>{parseError}</Text>
                            )}

                            {/* Action cards */}
                            {parsedActions.length > 0 ? (
                                <ScrollView style={styles.actionList} showsVerticalScrollIndicator={false}>
                                    {parsedActions.map((action, index) => (
                                        <VoiceActionCard
                                            key={`${action.type}-${index}`}
                                            action={action}
                                            index={index}
                                            onRemove={onRemoveAction}
                                        />
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={[styles.emptyState, { backgroundColor: colors.bgCard }]}>
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No actions detected. Try speaking more clearly.
                                    </Text>
                                </View>
                            )}

                            {/* Transcript reference (collapsed) */}
                            {displayTranscript && (
                                <View style={[styles.transcriptRef, { backgroundColor: colors.bgCard }]}>
                                    <Text style={[styles.transcriptRefLabel, { color: colors.textTertiary }]}>
                                        Heard:
                                    </Text>
                                    <Text style={[styles.transcriptRefText, { color: colors.textSecondary }]} numberOfLines={2}>
                                        {`\u201C${displayTranscript}\u201D`}
                                    </Text>
                                </View>
                            )}

                            {/* Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.secondaryBtn, { backgroundColor: colors.bgCard }]}
                                    onPress={onRetry}
                                >
                                    <RefreshCw size={16} color={colors.textSecondary} />
                                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Record Again</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.primaryBtn,
                                        { backgroundColor: VOICE_COLORS.success, opacity: (parsedActions.length === 0 || isCommitting) ? 0.5 : 1 }
                                    ]}
                                    onPress={handleCommit}
                                    disabled={parsedActions.length === 0 || isCommitting}
                                >
                                    {isCommitting ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <Check size={18} color="#ffffff" />
                                            <Text style={styles.primaryBtnText}>
                                                Confirm ({parsedActions.length})
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Cancel option */}
                            <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
                                <Text style={[styles.cancelLinkText, { color: colors.textTertiary }]}>Discard & Close</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </View>
            </View>
        </Modal>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        padding: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },

    // Recording
    recordingContainer: {
        alignItems: 'center',
        gap: 12,
    },
    micCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    micInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Parsing
    parsingContainer: {
        alignItems: 'center',
        gap: 8,
        paddingVertical: 16,
    },

    // Confirming
    confirmContainer: {
        gap: 8,
    },
    actionList: {
        maxHeight: 260,
        marginVertical: 8,
    },
    emptyState: {
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginVertical: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },

    // Shared
    phaseTitle: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    phaseSubtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
    transcriptBox: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 8,
    },
    transcriptText: {
        fontSize: 15,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    transcriptPlaceholder: {
        fontSize: 15,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    transcriptRef: {
        flexDirection: 'row',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        marginTop: 4,
    },
    transcriptRefLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    transcriptRefText: {
        fontSize: 12,
        flex: 1,
    },
    errorText: {
        fontSize: 13,
        textAlign: 'center',
        fontWeight: '600',
        marginTop: 4,
    },

    // Buttons
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
    },
    secondaryBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    cancelLink: {
        alignItems: 'center',
        paddingVertical: 8,
        marginTop: 4,
    },
    cancelLinkText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
