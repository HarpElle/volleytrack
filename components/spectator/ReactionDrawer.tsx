/**
 * ReactionDrawer — Expandable volleyball + hype reaction panel.
 *
 * Slides up from the bottom bar with two grouped sections:
 * "Volleyball" (sport-specific) and "Hype" (generic celebratory).
 * Auto-closes after 4s of no interaction.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface ReactionOption {
    key: string;
    emoji: string;
    label: string;
}

const VOLLEYBALL_REACTIONS: ReactionOption[] = [
    { key: 'stuff', emoji: '🧱', label: 'Block' },
    { key: 'spike', emoji: '💥', label: 'Spike' },
    { key: 'dig', emoji: '🦵', label: 'Dig' },
    { key: 'ace_serve', emoji: '🎯', label: 'Ace' },
    { key: 'setter', emoji: '🪄', label: 'Set' },
    { key: 'pancake', emoji: '🥞', label: 'Save' },
    { key: 'roof', emoji: '🏠', label: 'Roof' },
    { key: 'sideout', emoji: '✊', label: 'Side Out' },
];

const HYPE_REACTIONS: ReactionOption[] = [
    { key: 'clap', emoji: '👏', label: 'Clap' },
    { key: 'fire', emoji: '🔥', label: 'Fire' },
    { key: 'heart', emoji: '❤️', label: 'Love' },
    { key: 'muscle', emoji: '💪', label: 'Flex' },
    { key: 'hundred', emoji: '💯', label: '100' },
    { key: 'ball', emoji: '🏐', label: 'Ball' },
];

interface ReactionDrawerProps {
    visible: boolean;
    onClose: () => void;
    onReaction: (type: string) => void;
}

export function ReactionDrawer({ visible, onClose, onReaction }: ReactionDrawerProps) {
    const { colors, radius } = useAppTheme();
    const slideAnim = useRef(new Animated.Value(0)).current;
    const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [sentKey, setSentKey] = useState<string | null>(null);

    // Slide animation
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
        }).start();
    }, [visible]);

    // Auto-close after 4s of no interaction
    const resetAutoClose = useCallback(() => {
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = setTimeout(() => {
            onClose();
        }, 4000);
    }, [onClose]);

    useEffect(() => {
        if (visible) {
            resetAutoClose();
        }
        return () => {
            if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        };
    }, [visible, resetAutoClose]);

    const handleReaction = (key: string) => {
        resetAutoClose();
        onReaction(key);

        // Brief "sent" feedback
        setSentKey(key);
        setTimeout(() => setSentKey(null), 600);
    };

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [250, 0],
    });

    const opacity = slideAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.5, 1],
    });

    if (!visible) return null;

    const renderReactionGrid = (reactions: ReactionOption[]) => (
        <View style={styles.grid}>
            {reactions.map((r) => (
                <TouchableOpacity
                    key={r.key}
                    style={[
                        styles.reactionBtn,
                        {
                            backgroundColor: sentKey === r.key ? `${colors.primary}20` : `${colors.text}06`,
                            borderRadius: radius.sm,
                        },
                    ]}
                    onPress={() => handleReaction(r.key)}
                    activeOpacity={0.6}
                >
                    <Text style={styles.reactionEmoji}>{sentKey === r.key ? '✓' : r.emoji}</Text>
                    <Text style={[styles.reactionLabel, { color: colors.textSecondary }]}>{r.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <>
            {/* Backdrop */}
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            />

            <Animated.View
                style={[
                    styles.drawer,
                    {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                        transform: [{ translateY }],
                        opacity,
                    },
                ]}
            >
                {/* Volleyball section */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>VOLLEYBALL</Text>
                {renderReactionGrid(VOLLEYBALL_REACTIONS)}

                {/* Hype section */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 12 }]}>HYPE</Text>
                {renderReactionGrid(HYPE_REACTIONS)}
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 900,
    },
    drawer: {
        position: 'absolute',
        bottom: 56,
        left: 8,
        right: 8,
        zIndex: 901,
        padding: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    reactionBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        minWidth: 70,
        flexGrow: 1,
        flexBasis: '22%',
    },
    reactionEmoji: {
        fontSize: 22,
        marginBottom: 2,
    },
    reactionLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
});
