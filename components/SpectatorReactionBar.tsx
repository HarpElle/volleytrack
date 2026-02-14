/**
 * SpectatorReactionBar — Bottom bar on spectator screen with:
 * - Cheer button (with burst animation)
 * - Score alert button (with cooldown indicator)
 * - Viewer count
 * - Super Fan Recap button
 *
 * Replaces the static footer on the spectator view.
 */

import { AlertTriangle, Eye, Heart, Star } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface SpectatorReactionBarProps {
    viewerCount: number;
    cheerCount: number;
    cheerBurst: boolean;
    canSendCheer: boolean;
    canSendAlert: boolean;
    alertCooldownRemaining: number;
    matchCode: string;
    onCheer: () => void;
    onAlert: () => void;
    onFanRecap: () => void;
}

export function SpectatorReactionBar({
    viewerCount,
    cheerCount,
    cheerBurst,
    canSendCheer,
    canSendAlert,
    alertCooldownRemaining,
    matchCode,
    onCheer,
    onAlert,
    onFanRecap,
}: SpectatorReactionBarProps) {
    const { colors } = useAppTheme();
    const cheerScale = useRef(new Animated.Value(1)).current;

    // Cheer burst animation
    useEffect(() => {
        if (cheerBurst) {
            Animated.sequence([
                Animated.spring(cheerScale, {
                    toValue: 1.4,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 5,
                }),
                Animated.spring(cheerScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 200,
                    friction: 8,
                }),
            ]).start();
        }
    }, [cheerBurst]);

    const cooldownSeconds = Math.ceil(alertCooldownRemaining / 1000);

    return (
        <View style={[styles.container, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
            {/* Viewer Count */}
            <View style={styles.viewerSection}>
                <Eye size={14} color={colors.textTertiary} />
                <Text style={[styles.viewerText, { color: colors.textTertiary }]}>
                    {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                {/* Cheer Button */}
                <TouchableOpacity
                    style={[styles.actionBtn, { opacity: canSendCheer ? 1 : 0.5 }]}
                    onPress={onCheer}
                    disabled={!canSendCheer}
                    activeOpacity={0.6}
                >
                    <Animated.View style={{ transform: [{ scale: cheerScale }] }}>
                        <Heart
                            size={22}
                            color={cheerBurst ? colors.opponent : colors.textSecondary}
                            fill={cheerBurst ? colors.opponent : 'transparent'}
                        />
                    </Animated.View>
                    {cheerCount > 0 && (
                        <Text style={[styles.cheerCount, { color: colors.textTertiary }]}>{cheerCount}</Text>
                    )}
                </TouchableOpacity>

                {/* Score Alert Button */}
                <TouchableOpacity
                    style={[styles.actionBtn, { opacity: canSendAlert ? 1 : 0.5 }]}
                    onPress={onAlert}
                    disabled={!canSendAlert}
                    activeOpacity={0.6}
                >
                    <AlertTriangle size={20} color={canSendAlert ? colors.warning : colors.textTertiary} />
                    {!canSendAlert && cooldownSeconds > 0 && (
                        <Text style={[styles.cooldownText, { color: colors.textTertiary }]}>{cooldownSeconds}s</Text>
                    )}
                </TouchableOpacity>

                {/* Super Fan Recap Button */}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={onFanRecap}
                    activeOpacity={0.6}
                >
                    <Star size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Match Code */}
            <Text style={[styles.codeText, { color: colors.textTertiary }]}>{matchCode}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
    },
    viewerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    viewerText: {
        fontSize: 11,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 6,
    },
    cheerCount: {
        fontSize: 11,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    cooldownText: {
        fontSize: 10,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    codeText: {
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 12,
        fontVariant: ['tabular-nums'],
    },
});
