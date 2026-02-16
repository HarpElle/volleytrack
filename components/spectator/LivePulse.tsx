import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface LivePulseProps {
    /** true = live/connected, false = disconnected */
    isLive: boolean;
    /** Whether the match is in active rally state (pulses faster) */
    isActivePlay?: boolean;
    /** Size in pixels (default 8) */
    size?: number;
}

/**
 * Animated pulsing dot that indicates live connection status.
 * - Green, slow pulse when connected between points
 * - Green, fast pulse during active play (in-rally)
 * - Amber, no pulse when disconnected/reconnecting
 */
export function LivePulse({ isLive, isActivePlay = false, size = 8 }: LivePulseProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (animRef.current) {
            animRef.current.stop();
        }

        if (!isLive) {
            // No pulse when disconnected
            pulseAnim.setValue(1);
            return;
        }

        const duration = isActivePlay ? 500 : 1200;

        animRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: duration / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: duration / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        animRef.current.start();

        return () => {
            if (animRef.current) animRef.current.stop();
        };
    }, [isLive, isActivePlay]);

    const color = isLive ? '#4caf50' : '#f59e0b';
    const halfSize = size / 2;

    return (
        <View style={[styles.container, { width: size * 2, height: size * 2 }]}>
            {/* Outer glow ring (only when live) */}
            {isLive && (
                <Animated.View
                    style={[
                        styles.ring,
                        {
                            width: size * 2,
                            height: size * 2,
                            borderRadius: size,
                            borderColor: color,
                            opacity: pulseAnim.interpolate({
                                inputRange: [0.3, 1],
                                outputRange: [0, 0.4],
                            }),
                            transform: [{
                                scale: pulseAnim.interpolate({
                                    inputRange: [0.3, 1],
                                    outputRange: [1.4, 1],
                                }),
                            }],
                        },
                    ]}
                />
            )}

            {/* Core dot */}
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: size,
                        height: size,
                        borderRadius: halfSize,
                        backgroundColor: color,
                        opacity: isLive ? pulseAnim : 1,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        borderWidth: 1.5,
    },
    dot: {},
});
