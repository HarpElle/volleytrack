/**
 * AlertPopover — Small popover that appears above the alert button
 * with two options: "Score Check" and "Emergency Stop".
 *
 * Replaces having two separate alert buttons in the reaction bar,
 * keeping the bar cleaner.
 */

import { AlertTriangle, BarChart3, Siren } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface AlertPopoverProps {
    visible: boolean;
    onClose: () => void;
    onScoreCheck: () => void;
    onEmergency: () => void;
    canSendAlert: boolean;
    cooldownRemaining: number;
}

export function AlertPopover({
    visible,
    onClose,
    onScoreCheck,
    onEmergency,
    canSendAlert,
    cooldownRemaining,
}: AlertPopoverProps) {
    const { colors, radius } = useAppTheme();
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;

    const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <>
            {/* Invisible backdrop to catch taps */}
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            />

            <Animated.View
                style={[
                    styles.popover,
                    {
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        opacity,
                        transform: [{ translateY }],
                    },
                ]}
            >
                {/* Score Check option */}
                <TouchableOpacity
                    style={[
                        styles.option,
                        { borderBottomColor: colors.border, opacity: canSendAlert ? 1 : 0.5 },
                    ]}
                    onPress={() => {
                        onClose();
                        onScoreCheck();
                    }}
                    disabled={!canSendAlert}
                    activeOpacity={0.6}
                >
                    <BarChart3 size={18} color={colors.warning} />
                    <Text style={[styles.optionText, { color: colors.text }]}>Score Check</Text>
                </TouchableOpacity>

                {/* Emergency Stop option */}
                <TouchableOpacity
                    style={[styles.option, { borderBottomWidth: 0, opacity: canSendAlert ? 1 : 0.5 }]}
                    onPress={() => {
                        onClose();
                        onEmergency();
                    }}
                    disabled={!canSendAlert}
                    activeOpacity={0.6}
                >
                    <Siren size={18} color={colors.error} />
                    <Text style={[styles.optionText, { color: colors.error }]}>Emergency Stop</Text>
                </TouchableOpacity>

                {/* Cooldown indicator */}
                {!canSendAlert && cooldownSeconds > 0 && (
                    <View style={[styles.cooldownBar, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.cooldownText, { color: colors.textTertiary }]}>
                            {cooldownSeconds}s cooldown
                        </Text>
                    </View>
                )}

                {/* Arrow/caret pointing down */}
                <View style={[styles.arrow, { borderTopColor: colors.bgCard }]} />
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 998,
    },
    popover: {
        position: 'absolute',
        bottom: 56,
        right: 8,
        zIndex: 999,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        minWidth: 180,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    cooldownBar: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    cooldownText: {
        fontSize: 11,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    arrow: {
        position: 'absolute',
        bottom: -8,
        right: 20,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
});
