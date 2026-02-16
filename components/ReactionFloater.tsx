import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { Reaction } from '../hooks/useIncomingReactions';

const { width, height } = Dimensions.get('window');

interface ReactionFloaterProps {
    reactions: Reaction[];
}

interface FloatingEmoji {
    id: string;
    type: string;
    x: number;
    anim: Animated.Value;
}

const EMOJI_MAP: Record<string, string> = {
    // Hype
    fire: '🔥',
    clap: '👏',
    heart: '❤️',
    ball: '🏐',
    muscle: '💪',
    hundred: '💯',
    // Volleyball-specific
    stuff: '🧱',
    dig: '🦵',
    spike: '💥',
    ace_serve: '🎯',
    setter: '🪄',
    roof: '🏠',
    pancake: '🥞',
    sideout: '✊',
};

export function ReactionFloater({ reactions }: ReactionFloaterProps) {
    const [items, setItems] = useState<FloatingEmoji[]>([]);

    useEffect(() => {
        if (reactions.length === 0) return;

        // Process only NEW reactions (based on timestamp or just diffing)
        // Since the hook appends, we can just look at the last few additions 
        // effectively, but since the hook returns a growing list (capped), 
        // we need to be careful not to re-render old ones.
        // Actually, the hook logic `setReactions(prev => [...prev, ...newReactions])` 
        // implies `reactions` prop will change. 

        // Better approach: The parent should pass only *new* reactions or we filter here.
        // But `useEffect` triggers on `reactions` change.

        // Let's grab the latest reaction if it's recent (within 2 seconds)
        const latest = reactions[reactions.length - 1];
        if (!latest) return;

        if (Date.now() - latest.timestamp > 3000) return; // Ignore old history

        addFloatingEmoji(latest.id, latest.type);
    }, [reactions]);

    const addFloatingEmoji = (id: string, type: string) => {
        // Prevent duplicates
        if (items.find(i => i.id === id)) return;

        const startX = Math.random() * (width - 50); // Random X position
        const anim = new Animated.Value(0);

        const newItem: FloatingEmoji = { id, type, x: startX, anim };

        setItems(prev => [...prev, newItem]);

        Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + Math.random() * 1000, // 2-3 seconds
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            // Remove after animation
            setItems(prev => prev.filter(i => i.id !== id));
        });
    };

    if (items.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {items.map(item => {
                const translateY = item.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -height * 0.6], // Float up 60% of screen
                });

                const opacity = item.anim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [1, 1, 0], // Fade out at end
                });

                const scale = item.anim.interpolate({
                    inputRange: [0, 0.1, 1],
                    outputRange: [0.5, 1.2, 1], // Pop in
                });

                // Add some wiggle
                const translateX = item.anim.interpolate({
                    inputRange: [0, 0.3, 0.6, 1],
                    outputRange: [0, 20, -20, 0],
                });

                return (
                    <Animated.Text
                        key={item.id}
                        style={[
                            styles.emoji,
                            {
                                left: item.x,
                                bottom: 100, // Start above the reaction bar
                                opacity,
                                transform: [
                                    { translateY },
                                    { translateX },
                                    { scale }
                                ]
                            }
                        ]}
                    >
                        {EMOJI_MAP[item.type] || '👍'}
                    </Animated.Text>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
        justifyContent: 'flex-end',
    },
    emoji: {
        position: 'absolute',
        fontSize: 32,
    },
});
