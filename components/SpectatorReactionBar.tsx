/**
 * SpectatorReactionBar — Redesigned bottom bar on spectator screen.
 *
 * Clean layout with clear grouping:
 * [Viewers] [React ▾] [Cheer] [Chat] [Share] [Fan Recap] [Alert ▾]
 *
 * The alert button opens a popover with "Score Check" and "Emergency Stop".
 * The React button opens the ReactionDrawer with volleyball + hype reactions.
 * The Chat button opens the FanZoneModal.
 */

import { Activity, AlertTriangle, Heart, MessageCircle, Share2, Star, Users } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
    chatUnreadCount: number;
    alertsAllowed: boolean;
    recentAlertInfo: { type: string; senderName: string; secondsAgo: number } | null;
    onCheer: () => void;
    onReaction: (type: string) => void;
    onScoreAlert: () => void;
    onEmergencyAlert: () => void;
    onFanRecap: () => void;
    onOpenLobby: () => void;
    onOpenShare: () => void;
    onOpenFanZone: () => void;
    onOpenReactionDrawer: () => void;
    onToggleMeter: () => void;
    isMeterVisible: boolean;
}

export function SpectatorReactionBar({
    viewerCount,
    cheerCount,
    cheerBurst,
    canSendCheer,
    canSendAlert,
    alertCooldownRemaining,
    matchCode,
    chatUnreadCount,
    onCheer,
    onReaction,
    onScoreAlert,
    onEmergencyAlert,
    onFanRecap,
    onOpenLobby,
    onOpenShare,
    onOpenFanZone,
    onOpenReactionDrawer,
    onToggleMeter,
    isMeterVisible,
    alertsAllowed,
    recentAlertInfo,
}: SpectatorReactionBarProps) {
    const { colors, radius } = useAppTheme();
    const cheerScale = useRef(new Animated.Value(1)).current;
    const [showAlertMenu, setShowAlertMenu] = useState(false);

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
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenLobby}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <Users size={18} color={colors.textSecondary} />
                <Text style={[styles.btnLabel, { color: colors.textTertiary }]}>{viewerCount}</Text>
            </TouchableOpacity>

            {/* React Drawer Toggle */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenReactionDrawer}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <Text style={styles.reactEmoji}>🏐</Text>
            </TouchableOpacity>

            {/* Cheer Button */}
            <TouchableOpacity
                style={[styles.iconBtn, { opacity: canSendCheer ? 1 : 0.5 }]}
                onPress={onCheer}
                disabled={!canSendCheer}
                activeOpacity={0.6}
                hitSlop={4}
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

            {/* Fan Zone Chat */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenFanZone}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <View>
                    <MessageCircle size={18} color={colors.textSecondary} />
                    {chatUnreadCount > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                            <Text style={styles.unreadText}>
                                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {/* Meter Toggle */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onToggleMeter}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <Activity
                    size={18}
                    color={isMeterVisible ? colors.primary : colors.textSecondary}
                />
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onOpenShare}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <Share2 size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Fan Recap Button */}
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={onFanRecap}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <Star size={18} color={colors.primary} />
            </TouchableOpacity>

            {/* Alert Button (opens popover) */}
            <TouchableOpacity
                style={[styles.iconBtn, { opacity: (canSendAlert && alertsAllowed) ? 1 : 0.6 }]}
                onPress={() => {
                    if (showAlertMenu) {
                        setShowAlertMenu(false);
                    } else if (!alertsAllowed) {
                        // Don't open menu — alerts are muted by coach
                    } else if (canSendAlert) {
                        setShowAlertMenu(true);
                    }
                }}
                activeOpacity={0.6}
                hitSlop={4}
            >
                <AlertTriangle
                    size={18}
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

            {/* Alert Popover */}
            {showAlertMenu && (
                <>
                    <TouchableOpacity
                        style={styles.popoverBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowAlertMenu(false)}
                    />
                    <View
                        style={[
                            styles.popover,
                            {
                                backgroundColor: colors.bgCard,
                                borderColor: colors.border,
                                borderRadius: radius.md,
                            },
                        ]}
                    >
                        {/* Recent alert info banner (non-blocking) */}
                        {recentAlertInfo && (
                            <View style={[styles.recentAlertBanner, { backgroundColor: colors.primaryLight, borderBottomColor: colors.border }]}>
                                <Text style={[styles.recentAlertText, { color: colors.textSecondary }]}>
                                    {recentAlertInfo.senderName} sent a {recentAlertInfo.type === 'score_correction' ? 'score check' : 'alert'} {recentAlertInfo.secondsAgo}s ago
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[styles.popoverOption, { borderBottomColor: colors.border }]}
                            onPress={() => {
                                setShowAlertMenu(false);
                                onScoreAlert();
                            }}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.popoverEmoji}>📊</Text>
                            <Text style={[styles.popoverText, { color: colors.text }]}>Score Check</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.popoverOption, { borderBottomWidth: 0 }]}
                            onPress={() => {
                                setShowAlertMenu(false);
                                onEmergencyAlert();
                            }}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.popoverEmoji}>🚨</Text>
                            <Text style={[styles.popoverText, { color: colors.error }]}>Emergency Stop</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderTopWidth: 1,
        gap: 2,
    },
    iconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 8,
        paddingHorizontal: 7,
        minWidth: 36,
        minHeight: 36,
    },
    btnLabel: {
        fontSize: 11,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    reactEmoji: {
        fontSize: 20,
    },
    cooldownLabel: {
        fontSize: 9,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    unreadBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    unreadText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
    },
    // Popover styles
    popoverBackdrop: {
        position: 'absolute',
        top: -500,
        left: -50,
        right: -50,
        bottom: 0,
        zIndex: 998,
    },
    popover: {
        position: 'absolute',
        bottom: 52,
        right: 4,
        zIndex: 999,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
        minWidth: 170,
    },
    popoverOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    popoverEmoji: {
        fontSize: 18,
    },
    popoverText: {
        fontSize: 15,
        fontWeight: '600',
    },
    recentAlertBanner: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    recentAlertText: {
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 16,
    },
});
