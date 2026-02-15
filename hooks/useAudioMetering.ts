import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface AudioMeteringResult {
    meteringLevel: number; // 0 to 100
    isMetering: boolean;
    permissionGranted: boolean;
    startMetering: () => Promise<void>;
    stopMetering: () => Promise<void>;
    error: string | null;
}

export const useAudioMetering = (): AudioMeteringResult => {
    const [meteringLevel, setMeteringLevel] = useState(0);
    const [isMetering, setIsMetering] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);

    // Effect to check permissions on mount
    useEffect(() => {
        (async () => {
            const { status } = await Audio.getPermissionsAsync();
            setPermissionGranted(status === 'granted');
        })();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                stopMetering();
            }
        };
    }, []);

    // Handle App State changes (stop recording if backgrounded)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState.match(/inactive|background/) && isMetering) {
                stopMetering();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, [isMetering]);

    const startMetering = async () => {
        try {
            setError(null);

            // 1. Request Permission if needed
            if (!permissionGranted) {
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    setError('Microphone permission denied');
                    return;
                }
                setPermissionGranted(true);
            }

            // 2. Prepare Recording (optimized for metering only)
            // We set isMeteringEnabled: true
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                // We don't want to keep recording in background for battery reasons
            });

            const recording = new Audio.Recording();

            // We use LOW quality because we only care about volume, not fidelity
            await recording.prepareToRecordAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.MIN,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            });

            recording.setOnRecordingStatusUpdate((status) => {
                if (status.isRecording && status.metering !== undefined) {
                    // Metering is typically in dBFS (Decibels relative to Full Scale)
                    // Range: -160 (silence) to 0 (loudest)
                    // We want to normalize this to 0-100

                    const db = status.metering;

                    // Empirically, -60dB is quiet room, 0dB is clipping
                    // Let's map -60 -> 0 to 0 -> 100
                    const minDb = -60;
                    const maxDb = 0;

                    let normalized = ((db - minDb) / (maxDb - minDb)) * 100;
                    normalized = Math.max(0, Math.min(100, normalized));

                    setMeteringLevel(normalized);
                }
            });

            await recording.startAsync();
            recordingRef.current = recording;
            setIsMetering(true);

        } catch (err) {
            console.error("Failed to start metering", err);
            setError("Failed to access microphone");
            setIsMetering(false);
        }
    };

    const stopMetering = async () => {
        if (!recordingRef.current) return;

        try {
            setIsMetering(false);
            await recordingRef.current.stopAndUnloadAsync();
            recordingRef.current = null;
            setMeteringLevel(0);

            // Reset Audio Mode to allow playback (if needed elsewhere)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

        } catch (err) {
            console.error("Failed to stop metering", err);
        }
    };

    return {
        meteringLevel,
        isMetering,
        permissionGranted,
        startMetering,
        stopMetering,
        error
    };
};
