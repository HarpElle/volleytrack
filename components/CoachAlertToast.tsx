/**
 * CoachAlertToast — Non-modal animated toast for the coach's live screen.
 * Slides in from the top when a spectator sends a score correction alert.
 * Auto-dismisses after 5 seconds. Does NOT block coach input.
 */

import { AlertTriangle, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { SpectatorAlert } from '../types';

interface CoachAlertToastProps {
    alert: SpectatorAlert | null;
    onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function CoachAlertToast({ alert, onDismiss }: CoachAlertToastProps) {
    const { colors } = useAppTheme();
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

            // Auto-dismiss
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, AUTO_DISMISS_MS);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [alert?.id]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
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

    const scoreText = alert.suggestedScore
        ? `Thinks score is ${alert.suggestedScore.myTeam}-${alert.suggestedScore.opponent}`
        : 'Score may need checking';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.warningLight,
                    borderColor: colors.warning,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
            pointerEvents="box-none"
        >
            <View style={styles.row}>
                <AlertTriangle size={20} color={colors.warning} />
                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        Score Check from {alert.senderName}
                    </Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={1}>
                        {alert.message || scoreText}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                    <X size={18} color={colors.textSecondary} />
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
    },
    message: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
});
