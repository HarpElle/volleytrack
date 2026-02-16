import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { MomentumEvent } from '../../hooks/useMomentumDetection';

interface MomentumBannerProps {
    event: MomentumEvent | null;
    onDismiss: () => void;
}

/**
 * Animated contextual banner that slides in from the top for notable game moments.
 * Color-coded by mood: positive (green), negative (opponent coral), neutral (amber), urgent (red).
 */
export function MomentumBanner({ event, onDismiss }: MomentumBannerProps) {
    const { colors } = useAppTheme();
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (event) {
            // Slide in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 12,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Slide out
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [event]);

    if (!event) return null;

    const moodColors: Record<string, { bg: string; text: string; border: string }> = {
        positive: {
            bg: `${colors.momentumPositive}20`,
            text: colors.momentumPositive,
            border: `${colors.momentumPositive}40`,
        },
        negative: {
            bg: `${colors.opponent}15`,
            text: colors.opponent,
            border: `${colors.opponent}30`,
        },
        neutral: {
            bg: `${colors.momentumCaution}15`,
            text: colors.momentumCaution,
            border: `${colors.momentumCaution}30`,
        },
        urgent: {
            bg: `${colors.momentumUrgent}15`,
            text: colors.momentumUrgent,
            border: `${colors.momentumUrgent}40`,
        },
    };

    const style = moodColors[event.mood] || moodColors.neutral;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: style.bg,
                    borderColor: style.border,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.inner}
                onPress={onDismiss}
                activeOpacity={0.8}
            >
                <Text style={styles.emoji}>{event.emoji}</Text>
                <Text style={[styles.message, { color: style.text }]} numberOfLines={2}>
                    {event.message}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 12,
        right: 12,
        zIndex: 200,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 10,
    },
    emoji: {
        fontSize: 22,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});
