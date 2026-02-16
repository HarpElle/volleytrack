import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const CELEBRATION_EMOJI = ['🎉', '🏐', '🔥', '👏', '❤️', '⭐', '💪', '🏆'];
const PARTICLE_COUNT = 25;

interface Particle {
    id: number;
    emoji: string;
    x: number;
    animY: Animated.Value;
    animOpacity: Animated.Value;
    scale: number;
    speed: number;
}

interface EmojiRainProps {
    /** Set to true to trigger one burst of emoji rain */
    trigger: boolean;
    /** Called when the rain animation completes */
    onComplete?: () => void;
}

/**
 * Brief celebratory emoji rain across the screen for major moments
 * (set won, match point converted, 5+ point run).
 * Purely decorative — 25 small emoji fall from top to bottom over ~2.5 seconds.
 */
export function EmojiRain({ trigger, onComplete }: EmojiRainProps) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const completedRef = useRef(0);

    useEffect(() => {
        if (!trigger) return;

        completedRef.current = 0;

        const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
            const animY = new Animated.Value(-40);
            const animOpacity = new Animated.Value(1);
            const speed = 1800 + Math.random() * 1200; // 1.8–3s fall time
            const delay = Math.random() * 600; // stagger start up to 600ms

            return {
                id: i,
                emoji: CELEBRATION_EMOJI[Math.floor(Math.random() * CELEBRATION_EMOJI.length)],
                x: Math.random() * (SCREEN_WIDTH - 30),
                animY,
                animOpacity,
                scale: 0.7 + Math.random() * 0.6, // 0.7–1.3x
                speed,
            };
        });

        setParticles(newParticles);

        // Start animations
        newParticles.forEach((p) => {
            const delay = Math.random() * 600;

            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(p.animY, {
                        toValue: SCREEN_HEIGHT + 40,
                        duration: p.speed,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.delay(p.speed * 0.7),
                        Animated.timing(p.animOpacity, {
                            toValue: 0,
                            duration: p.speed * 0.3,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]).start(() => {
                completedRef.current += 1;
                if (completedRef.current >= PARTICLE_COUNT) {
                    setParticles([]);
                    onComplete?.();
                }
            });
        });
    }, [trigger]);

    if (particles.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {particles.map((p) => (
                <Animated.View
                    key={p.id}
                    style={[
                        styles.particle,
                        {
                            left: p.x,
                            transform: [
                                { translateY: p.animY },
                                { scale: p.scale },
                            ],
                            opacity: p.animOpacity,
                        },
                    ]}
                >
                    <Text style={styles.emoji}>{p.emoji}</Text>
                </Animated.View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 300,
    },
    particle: {
        position: 'absolute',
        top: 0,
    },
    emoji: {
        fontSize: 24,
    },
});
