import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { VOICE_RECORDING_MAX_MS } from '../constants/voice';
import { ParsedVoiceAction, VoiceParsingService } from '../services/ai/VoiceParsingService';
import { useMatchStore } from '../store/useMatchStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { Player, StatLog } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export type VoiceInputPhase = 'idle' | 'recording' | 'parsing' | 'confirming';

export interface VoiceInputState {
    phase: VoiceInputPhase;
    isListening: boolean;
    liveTranscript: string;
    finalTranscript: string;
    parsedActions: ParsedVoiceAction[];
    isParsing: boolean;
    parseError: string | null;
    error: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const voiceParser = new VoiceParsingService();

export function useVoiceInput() {
    const [phase, setPhase] = useState<VoiceInputPhase>('idle');
    const [isListening, setIsListening] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [finalTranscript, setFinalTranscript] = useState('');
    const [parsedActions, setParsedActions] = useState<ParsedVoiceAction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Track recording timeout
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Speech Recognition Event Handlers ────────────────────────────────

    useSpeechRecognitionEvent('start', () => {
        setIsListening(true);
    });

    useSpeechRecognitionEvent('end', () => {
        setIsListening(false);
    });

    useSpeechRecognitionEvent('result', (event) => {
        const transcript = event.results[0]?.transcript || '';

        if (event.isFinal) {
            setFinalTranscript(prev => {
                const combined = prev ? `${prev} ${transcript}` : transcript;
                return combined.trim();
            });
        }
        setLiveTranscript(transcript);
    });

    useSpeechRecognitionEvent('error', (event) => {
        console.warn('Speech recognition error:', event.error, event.message);

        // Don't treat "no-speech" as a hard error — user just didn't say anything
        if (event.error === 'no-speech') {
            setError('No speech detected. Try again and speak clearly.');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError('Microphone permission denied. Check your device settings.');
        } else {
            setError(`Speech recognition error: ${event.message || event.error}`);
        }

        setIsListening(false);
        setPhase('idle');
    });

    // ── Actions ──────────────────────────────────────────────────────────

    const startListening = useCallback(async () => {
        try {
            setError(null);
            setParseError(null);
            setLiveTranscript('');
            setFinalTranscript('');
            setParsedActions([]);

            // Check/request permissions
            const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!granted) {
                setError('Microphone permission is required for voice input.');
                return;
            }

            setPhase('recording');

            // Start speech recognition
            ExpoSpeechRecognitionModule.start({
                lang: 'en-US',
                interimResults: true,
                continuous: true,
                // Android 13+ supports continuous mode
                // On older Android, it may auto-stop after pauses
            });

            // Safety timeout: auto-stop after max duration
            timeoutRef.current = setTimeout(() => {
                stopListeningAndParse();
            }, VOICE_RECORDING_MAX_MS);

        } catch (err: any) {
            console.error('Failed to start voice recognition:', err);
            setError('Could not start voice recognition. Please try again.');
            setPhase('idle');
        }
    }, []);

    const stopListeningAndParse = useCallback(async () => {
        // Clear timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        // Stop speech recognition
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);

        // Wait a brief moment for final results to arrive
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the transcript to parse
        // We need to use the latest state, so read from a ref or use the setter callback
        // Using a promise-based approach to get latest state
        parseCurrentTranscript();
    }, []);

    const parseCurrentTranscript = useCallback(async () => {
        // Access latest state values from the stores
        const matchState = useMatchStore.getState();
        const { servingTeam, rallyState, scores, currentSet, myTeamName, myTeamRoster, currentRotation } = matchState;
        const currentScore = scores[currentSet - 1] || { myTeam: 0, opponent: 0 };

        // Get roster and current court lineup
        const roster = myTeamRoster || [];
        const rotation = currentRotation || [];

        // Get the transcript — combine final + any remaining live
        // We need to access the latest state value
        setFinalTranscript(prev => {
            const transcript = prev.trim();

            if (!transcript) {
                setParseError('No speech detected. Please try again.');
                setPhase('idle');
                return prev;
            }

            // Kick off parsing (async, but we can't await inside setState)
            doParse(transcript, roster, servingTeam, rallyState, currentScore, myTeamName, rotation);
            return prev;
        });
    }, []);

    const doParse = useCallback(async (
        transcript: string,
        roster: Player[],
        servingTeam: 'myTeam' | 'opponent',
        rallyState: 'pre-serve' | 'in-rally',
        currentScore: { myTeam: number; opponent: number },
        myTeamName: string,
        currentRotation: any[] = [],
    ) => {
        setPhase('parsing');
        setIsParsing(true);
        setParseError(null);

        try {
            const result = await voiceParser.parseVoiceInput(
                transcript,
                roster,
                servingTeam,
                rallyState,
                currentScore,
                myTeamName,
                currentRotation,
            );

            if (result.error) {
                setParseError(result.error);
                setParsedActions([]);
                // Stay on parsing screen so user can retry
                setPhase(result.actions.length > 0 ? 'confirming' : 'recording');
            } else {
                setParsedActions(result.actions);
                setPhase('confirming');
            }
        } catch (err: any) {
            console.error('Voice parsing failed:', err);
            setParseError('Something went wrong. Please try again.');
            setPhase('recording');
        } finally {
            setIsParsing(false);
        }
    }, []);

    const cancelSession = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (isListening) {
            ExpoSpeechRecognitionModule.stop();
        }

        setPhase('idle');
        setIsListening(false);
        setLiveTranscript('');
        setFinalTranscript('');
        setParsedActions([]);
        setIsParsing(false);
        setParseError(null);
        setError(null);
    }, [isListening]);

    const retryRecording = useCallback(() => {
        setLiveTranscript('');
        setFinalTranscript('');
        setParsedActions([]);
        setParseError(null);
        setError(null);
        startListening();
    }, [startListening]);

    const editAction = useCallback((index: number, updates: Partial<ParsedVoiceAction>) => {
        setParsedActions(prev => {
            const next = [...prev];
            if (next[index]) {
                next[index] = { ...next[index], ...updates };
            }
            return next;
        });
    }, []);

    const removeAction = useCallback((index: number) => {
        setParsedActions(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * Commit all parsed actions to the match store sequentially.
     * Each recordStat call handles state transitions (score, rally state, rotation).
     * On failure, undo all previously committed actions in this batch.
     */
    const commitAll = useCallback(async (): Promise<boolean> => {
        const actions = parsedActions;
        if (actions.length === 0) return false;

        const committedCount = { value: 0 };

        try {
            for (const action of actions) {
                const { recordStat } = useMatchStore.getState();

                // Build metadata for assist tracking
                const metadata: any = {};
                if (action.assistPlayerId) {
                    metadata.assistPlayerId = action.assistPlayerId;
                }
                metadata.voiceInput = true; // Tag for analytics

                recordStat(
                    action.type as StatLog['type'],
                    action.team,
                    action.playerId,
                    metadata,
                );
                committedCount.value++;
            }

            // Register this match as voice-enabled for free tier tracking
            const matchId = useMatchStore.getState().matchId;
            if (matchId) {
                useSubscriptionStore.getState().registerVoiceMatch(matchId);
            }

            // Success — reset state
            setPhase('idle');
            setParsedActions([]);
            setFinalTranscript('');
            setLiveTranscript('');

            return true;
        } catch (err: any) {
            console.error('Voice commit failed after', committedCount.value, 'actions:', err);

            // Rollback: undo all committed actions in reverse
            const { undo } = useMatchStore.getState();
            for (let i = 0; i < committedCount.value; i++) {
                undo();
            }

            Alert.alert(
                'Commit Failed',
                `An error occurred after logging ${committedCount.value} action(s). All changes have been rolled back. Please try again.`,
                [{ text: 'OK' }]
            );

            return false;
        }
    }, [parsedActions]);

    return {
        // State
        phase,
        isListening,
        liveTranscript,
        finalTranscript,
        parsedActions,
        isParsing,
        parseError,
        error,

        // Actions
        startListening,
        stopListeningAndParse,
        cancelSession,
        retryRecording,
        editAction,
        removeAction,
        commitAll,
    };
}
