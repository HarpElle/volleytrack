/**
 * ProudMomentCard — Toast-style card that appears when a cheered-for
 * player makes a significant play (ace, kill, block).
 *
 * Includes a "Share" button so parents can instantly share the moment.
 * Auto-dismisses after 5 seconds if no interaction.
 */

import { Share2, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../contexts/ThemeContext';
import { Score } from '../../types';

const EVENT_LABELS: Record<string, { emoji: string; label: string }> = {
    ace: { emoji: '🎯', label: 'ACE' },
    kill: { emoji: '💥', label: 'KILL' },
    block: { emoji: '🧱', label: 'BLOCK' },
};

interface ProudMomentCardProps {
    visible: boolean;
    playerName: string;
    jerseyNumber?: string;
    eventType: string; // 'ace' | 'kill' | 'block'
    teamName: string;
    score: Score;
    currentSet: number;
    matchCode: string;
    onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function ProudMomentCard({
    visible,
    playerName,
    jerseyNumber,
    eventType,
    teamName,
    score,
    currentSet,
    matchCode,
    onDismiss,
}: ProudMomentCardProps) {
    const { colors, radius } = useAppTheme();
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const event = EVENT_LABELS[eventType] || { emoji: '🌟', label: eventType.toUpperCase() };
    const playerTag = jerseyNumber ? `#${jerseyNumber} ${playerName}` : playerName;

    useEffect(() => {
        if (visible) {
            // Haptic feedback
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}

            // Slide in from top
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 10,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss
            timerRef.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible]);

    const handleDismiss = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    const handleShare = async () => {
        const scoreText = `${teamName} ${score.myTeam > score.opponent ? 'lead' : 'trail'} ${score.myTeam}-${score.opponent}`;
        const message = `🏐 Proud parent moment!\n${playerTag} just got a ${event.label}! ${event.emoji}\n${scoreText} in Set ${currentSet}\nFollow live on VolleyTrack: ${matchCode}`;

        try {
            await Share.share({ message });
        } catch (_) {}
        handleDismiss();
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.primary,
                    borderRadius: radius.lg,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <View style={styles.row}>
                <View style={styles.content}>
                    <Text style={[styles.header, { color: colors.primary }]}>
                        🌟 PROUD MOMENT
                    </Text>
                    <Text style={[styles.playText, { color: colors.text }]}>
                        {playerTag} just got a {event.label}! {event.emoji}
                    </Text>
                    <Text style={[styles.context, { color: colors.textSecondary }]}>
                        Set {currentSet} · {teamName} {score.myTeam}-{score.opponent}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                    <X size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
                    onPress={handleShare}
                    activeOpacity={0.7}
                >
                    <Share2 size={14} color="#fff" />
                    <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDismiss} activeOpacity={0.6}>
                    <Text style={[styles.dismissText, { color: colors.textTertiary }]}>Dismiss</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 12,
        right: 12,
        zIndex: 110,
        padding: 14,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    content: {
        flex: 1,
    },
    header: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    playText: {
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 22,
    },
    context: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 12,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    shareBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    dismissText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
