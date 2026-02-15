import { Mic, MicOff, ThumbsUp } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAudioMetering } from '../../hooks/useAudioMetering';

interface CheerMeterProps {
    onCheerPulse: (intensity: number) => void;
}

export default function CheerMeter({ onCheerPulse }: CheerMeterProps) {
    const { meteringLevel, isMetering, permissionGranted, startMetering, stopMetering, error } = useAudioMetering();
    const [tapEnergy, setTapEnergy] = useState(0);
    const [lastPulseTime, setLastPulseTime] = useState(0);

    // Animated value for the meter height
    const meterHeight = useRef(new Animated.Value(0)).current;

    // Decay the tap energy over time
    useEffect(() => {
        const interval = setInterval(() => {
            setTapEnergy(prev => Math.max(0, prev - 5));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Combine inputs and drive animation
    useEffect(() => {
        // Combined level: Mic (0-100) + Tap (0-100)
        // Cap at 100
        const combined = Math.min(100, meteringLevel + tapEnergy);

        Animated.timing(meterHeight, {
            toValue: combined,
            duration: 100,
            useNativeDriver: false, // Height layout animation
            easing: Easing.out(Easing.quad),
        }).start();

        // Send pulse if significant and throttled
        const now = Date.now();
        if (combined > 10 && now - lastPulseTime > 2000) {
            onCheerPulse(combined);
            setLastPulseTime(now);
        }

    }, [meteringLevel, tapEnergy]);

    const handleTap = () => {
        // Add energy on tap
        setTapEnergy(prev => Math.min(100, prev + 20));
        // Also trigger haptic if possible (passed from prop or imported)
    };

    const toggleMic = () => {
        if (isMetering) {
            stopMetering();
        } else {
            startMetering();
        }
    };

    // Color interpolation for the meter bar
    const barColor = meterHeight.interpolate({
        inputRange: [0, 50, 80, 100],
        outputRange: ['#4ade80', '#fbbf24', '#f87171', '#ef4444'] // Green -> Yellow -> Red -> Deep Red
    });

    return (
        <View style={styles.container}>
            <View style={styles.meterContainer}>
                <View style={styles.meterBackground}>
                    <Animated.View
                        style={[
                            styles.meterFill,
                            {
                                height: meterHeight.interpolate({
                                    inputRange: [0, 100],
                                    outputRange: ['0%', '100%']
                                }),
                                backgroundColor: barColor
                            }
                        ]}
                    />
                </View>
                <Text style={styles.label}>NOISE LEVEL</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.micButton, isMetering && styles.micActive]}
                    onPress={toggleMic}
                >
                    {isMetering ? (
                        <Mic color="#fff" size={24} />
                    ) : (
                        <MicOff color="#fff" size={24} />
                    )}
                </TouchableOpacity>
                <Text style={styles.micLabel}>{isMetering ? "Mic ON" : "Mic OFF"}</Text>
                {/* {error && <Text style={styles.errorText}>Error</Text>} */}

                <TouchableOpacity
                    style={styles.cheerButton}
                    activeOpacity={0.7}
                    onPress={handleTap}
                >
                    <ThumbsUp color="#000" size={32} fill="#000" />
                    <Text style={styles.cheerText}>TAP TO CHEER!</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1f2937', // Dark gray
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        maxWidth: 400,
    },
    meterContainer: {
        alignItems: 'center',
        height: 140,
        justifyContent: 'space-between',
    },
    meterBackground: {
        width: 30,
        height: 120,
        backgroundColor: '#374151',
        borderRadius: 15,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    meterFill: {
        width: '100%',
        borderRadius: 15,
    },
    label: {
        color: '#9ca3af',
        fontSize: 10,
        marginTop: 4,
        fontWeight: 'bold',
    },
    controls: {
        flex: 1,
        gap: 12,
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4b5563',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    micActive: {
        backgroundColor: '#ef4444', // Red when live
    },
    micLabel: {
        color: '#d1d5db',
        fontSize: 12,
        marginLeft: 4,
        marginTop: -8,
        marginBottom: 4,
    },
    cheerButton: {
        backgroundColor: '#fbbf24', // Amber
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    cheerText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        fontSize: 10
    }
});
