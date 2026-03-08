/**
 * SpectatorReactionBar — Bottom bar on spectator screen.
 *
 * Simplified 4-button layout:
 *   [Viewers]  [Cheer ❤️]  [Alert/Recap]  [Help ?]
 *
 * Alert/Recap is contextual: AlertTriangle during match, Star after match ends.
 */

import { AlertTriangle, Heart, HelpCircle, Star, Users } from 'lucide-react-native';
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
    alertsAllowed: boolean;
    recentAlertInfo: { type: string; senderName: string; secondsAgo: number } | null;
    isMatchEnded?: boolean;
    onCheer: () => void;
    onOpenLobby: () => void;
    onOpenReactionDrawer: () => void;
    onOpenAlertModal: () => void;
    onFanRecap: () => void;
    onOpenQuickGuide: () => void;
}

export function SpectatorReactionBar({
    viewerCount,
    cheerCount,
    cheerBurst,
    canSendCheer,
    canSendAlert,
    alertCooldownRemaining,
    alertsAllowed,
    isMatchEnded,
    onCheer,
    onOpenLobby,
    onOpenReactionDrawer,
    onOpenAlertModal,
    onFanRecap,
    onOpenQuickGuide,
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
            {/* ── Viewers ── */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenLobby}
                activeOpacity={0.6}
                hitSlop={6}
            >
                <Users size={20} color={colors.textSecondary} />
                <Text style={[styles.btnLabel, { color: colors.textTertiary }]}>{viewerCount}</Text>
            </TouchableOpacity>

            {/* ── Cheer (long-press for reactions) ── */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => { if (canSendCheer) onCheer(); }}
                onLongPress={onOpenReactionDrawer}
                activeOpacity={0.6}
                hitSlop={6}
            >
                <Animated.View style={{ transform: [{ scale: cheerScale }] }}>
                    <Heart
                        size={20}
                        color={cheerBurst ? colors.error : colors.textSecondary}
                        fill={cheerBurst ? colors.error : 'transparent'}
                    />
                </Animated.View>
                {cheerCount > 0 && (
                    <Text style={[styles.btnLabel, { color: colors.textTertiary }]}>{cheerCount}</Text>
                )}
            </TouchableOpacity>

            {/* ── Alert / Recap (contextual) ── */}
            {isMatchEnded ? (
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={onFanRecap}
                    activeOpacity={0.6}
                    hitSlop={6}
                >
                    <Star size={20} color={colors.primary} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[styles.iconBtn, { opacity: (canSendAlert && alertsAllowed) ? 1 : 0.6 }]}
                    onPress={onOpenAlertModal}
                    activeOpacity={0.6}
                    hitSlop={6}
                >
                    <AlertTriangle
                        size={20}
                        color={!alertsAllowed ? colors.textTertiary : canSendAlert ? colors.warning : colors.textTertiary}
                    />
                    {!alertsAllowed ? (
                        <Text style={[styles.cooldownLabel, { color: colors.textTertiary }]}>Off</Text>
                    ) : !canSendAlert && cooldownSeconds > 0 ? (
                        <Text style={[styles.cooldownLabel, { color: colors.textTertiary }]}>
                            {cooldownSeconds}s
                        </Text>
                    ) : null}
                </TouchableOpacity>
            )}

            {/* ── Help ── */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenQuickGuide}
                activeOpacity={0.6}
                hitSlop={6}
            >
                <HelpCircle size={20} color={colors.textTertiary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderTopWidth: 1,
    },
    iconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 48,
        minHeight: 44,
    },
    btnLabel: {
        fontSize: 12,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    cooldownLabel: {
        fontSize: 9,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
});
