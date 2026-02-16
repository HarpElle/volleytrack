/**
 * CoachAlertToast — Non-modal animated toast for the coach's live screen.
 * Slides in from the top when a spectator sends an alert.
 *
 * Score corrections show side-by-side score comparison.
 * Emergency alerts use red styling and do NOT auto-dismiss.
 */

import { AlertOctagon, AlertTriangle, BarChart3, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../contexts/ThemeContext';
import { SpectatorAlert } from '../types';

interface CoachAlertToastProps {
    alert: SpectatorAlert | null;
    onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function CoachAlertToast({ alert, onDismiss }: CoachAlertToastProps) {
    const { colors } = useAppTheme();
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isEmergency = alert?.type === 'emergency';
    const isScoreCorrection = alert?.type === 'score_correction';

    useEffect(() => {
        if (alert) {
            // Slide in
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

            // Haptic feedback for emergencies
            if (alert.type === 'emergency') {
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } catch (_) {}
            }

            // Auto-dismiss ONLY for non-emergency alerts
            if (alert.type !== 'emergency') {
                timerRef.current = setTimeout(() => {
                    handleDismiss();
                }, AUTO_DISMISS_MS);
            }
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [alert?.id]);

    const handleDismiss = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -150,
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

    if (!alert) return null;

    // Determine styling based on alert type
    const bgColor = isEmergency ? colors.errorLight || '#fee2e2' : colors.warningLight;
    const borderColor = isEmergency ? colors.error : colors.warning;
    const iconColor = isEmergency ? colors.error : colors.warning;
    const Icon = isEmergency ? AlertOctagon : isScoreCorrection ? BarChart3 : AlertTriangle;

    // Build title
    const titlePrefix = isEmergency ? '🚨' : '📊';
    const titleLabel = isEmergency ? 'EMERGENCY' : 'Score Check';
    const titleText = `${titlePrefix} ${titleLabel} from ${alert.senderName}`;

    return (
        <Animated.View
            style={[
                styles.container,
                isEmergency && styles.containerEmergency,
                {
                    backgroundColor: bgColor,
                    borderColor,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
            pointerEvents="box-none"
        >
            <View style={styles.row}>
                <Icon size={22} color={iconColor} />
                <View style={styles.textContainer}>
                    <Text
                        style={[styles.title, { color: isEmergency ? colors.error : colors.text }]}
                        numberOfLines={1}
                    >
                        {titleText}
                    </Text>

                    {/* Score correction: show side-by-side comparison */}
                    {isScoreCorrection && alert.suggestedScore ? (
                        <View style={styles.scoreComparison}>
                            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
                                App: {alert.suggestedScore.myTeam !== undefined ? `—` : '—'}
                            </Text>
                            <Text style={[styles.scoreCompare, { color: colors.text }]}>
                                App: {alert.currentSet ? `Set ${alert.currentSet}` : ''} →  Score Table: {alert.suggestedScore.myTeam}-{alert.suggestedScore.opponent}
                            </Text>
                            {alert.message && (
                                <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
                                    "{alert.message}"
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
                            {alert.message || 'Score may need checking'}
                        </Text>
                    )}
                </View>
                <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                    <X size={18} color={isEmergency ? colors.error : colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        marginHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    containerEmergency: {
        borderWidth: 2,
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
    },
    scoreComparison: {
        marginTop: 4,
    },
    scoreLabel: {
        fontSize: 12,
        fontWeight: '500',
        display: 'none', // Hidden - used for accessibility
    },
    scoreCompare: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    message: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
        fontStyle: 'italic',
    },
    closeBtn: {
        padding: 4,
    },
});
