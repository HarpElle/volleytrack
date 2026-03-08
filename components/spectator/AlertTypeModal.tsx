/**
 * AlertTypeModal — Bottom-sheet modal for choosing an alert type.
 *
 * Replaces the fragile popover in SpectatorReactionBar.
 * Two options: Score Check → opens ScoreCorrectionModal,
 * Emergency Stop → opens EmergencyAlertModal.
 */

import { AlertOctagon, BarChart3, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface AlertTypeModalProps {
    visible: boolean;
    onClose: () => void;
    onScoreCheck: () => void;
    onEmergencyStop: () => void;
    alertsAllowed: boolean;
    canSendAlert: boolean;
    cooldownSeconds: number;
    recentAlertInfo: { type: string; senderName: string; secondsAgo: number } | null;
}

export function AlertTypeModal({
    visible,
    onClose,
    onScoreCheck,
    onEmergencyStop,
    alertsAllowed,
    canSendAlert,
    cooldownSeconds,
    recentAlertInfo,
}: AlertTypeModalProps) {
    const { colors, radius } = useAppTheme();
    const slideAnim = useRef(new Animated.Value(400)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 80,
                        friction: 12,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, 120);
        } else {
            slideAnim.setValue(400);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const handleScoreCheck = () => {
        onClose();
        onScoreCheck();
    };

    const handleEmergencyStop = () => {
        onClose();
        onEmergencyStop();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <Animated.View style={[styles.sheet, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
                    {/* Handle bar */}
                    <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Alert the Coach</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} accessibilityLabel="Close">
                            <X size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Alerts disabled by coach */}
                    {!alertsAllowed && (
                        <View style={[styles.disabledBanner, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
                                Alerts are turned off by the coach for this match.
                            </Text>
                        </View>
                    )}

                    {/* Cooldown warning */}
                    {alertsAllowed && !canSendAlert && cooldownSeconds > 0 && (
                        <View style={[styles.cooldownBanner, { backgroundColor: `${colors.warning}15` }]}>
                            <Text style={[styles.cooldownText, { color: colors.warning }]}>
                                Please wait {cooldownSeconds}s before sending another alert.
                            </Text>
                        </View>
                    )}

                    {/* Recent alert info */}
                    {recentAlertInfo && (
                        <View style={[styles.recentBanner, { backgroundColor: colors.primaryLight }]}>
                            <Text style={[styles.recentText, { color: colors.textSecondary }]}>
                                {recentAlertInfo.senderName} sent a {recentAlertInfo.type === 'score_correction' ? 'score check' : 'alert'} {recentAlertInfo.secondsAgo}s ago
                            </Text>
                        </View>
                    )}

                    {/* Score Check option */}
                    <TouchableOpacity
                        style={[
                            styles.optionCard,
                            {
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                opacity: (alertsAllowed && canSendAlert) ? 1 : 0.5,
                            },
                        ]}
                        onPress={handleScoreCheck}
                        disabled={!alertsAllowed || !canSendAlert}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.optionIcon, { backgroundColor: `${colors.primary}15` }]}>
                            <BarChart3 size={24} color={colors.primary} />
                        </View>
                        <View style={styles.optionContent}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>Score Check</Text>
                            <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                                I think the score might be wrong
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Emergency Stop option */}
                    <TouchableOpacity
                        style={[
                            styles.optionCard,
                            {
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                opacity: (alertsAllowed && canSendAlert) ? 1 : 0.5,
                            },
                        ]}
                        onPress={handleEmergencyStop}
                        disabled={!alertsAllowed || !canSendAlert}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.optionIcon, { backgroundColor: `${colors.error}15` }]}>
                            <AlertOctagon size={24} color={colors.error} />
                        </View>
                        <View style={styles.optionContent}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>Emergency Stop</Text>
                            <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                                Something unsafe — alert the coach now
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Cancel button */}
                    <TouchableOpacity
                        style={[styles.cancelBtn, { borderColor: colors.border }]}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 34, // Safe area
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
    },
    handleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    disabledBanner: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    disabledText: {
        fontSize: 14,
        textAlign: 'center',
    },
    cooldownBanner: {
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    cooldownText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    recentBanner: {
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    recentText: {
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        gap: 14,
        minHeight: 72,
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionContent: {
        flex: 1,
        gap: 2,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    optionDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
